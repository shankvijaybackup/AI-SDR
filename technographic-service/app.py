import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

# Internal imports
from hunter_logic import TechnographicHunter
# We import the waterfall logic here to inject it into the hunter or use it directly
from search_utils import waterfall_search 

# LOGGING SETUP
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TechnographicService")

# CONFIGURATION
# You need these if the scraper fails (Get them from Google Cloud Console)
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "") 
GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID", "")   

# GLOBAL MODEL INSTANCE
# We use a global variable to keep the 4GB model in memory across requests
hunter_instance: Optional[TechnographicHunter] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    LIFESPAN MANAGER
    1. Startup: Loads the Heavy AI Model (NuExtract) into VRAM.
    2. Shutdown: Cleans up resources.
    """
    global hunter_instance
    logger.info("🚀 STARTUP: Initializing Technographic Hunter Model...")
    
    # Check for CPU_ONLY mode (e.g. for Render free tier)
    if os.getenv("CPU_ONLY", "false").lower() == "true":
        logger.warning("⚠️ CPU_ONLY mode detected. Skipping Heavy Model Load.")
        logger.warning("   Technographic extraction will rely on Waterfall Search and basic Regex/Heuristics only.")
        hunter_instance = None # Or a lightweight mock if needed
        yield
        return

    try:
        # Initialize with 4-bit quantization for efficiency (Requires GPU)
        hunter_instance = TechnographicHunter(load_4bit=True)
        logger.info("✅ MODEL LOADED: Ready for extraction.")
    except Exception as e:
        logger.critical(f"❌ MODEL FAILED TO LOAD: {e}")
        logger.warning("   Continuing in DEGRADED mode (Search only).")
        # We allow app to start even if model fails
        
    yield
    
    logger.info("🛑 SHUTDOWN: Unloading resources...")
    hunter_instance = None

# INITIALIZE APP
app = FastAPI(title="Technographic Enrichment Service", lifespan=lifespan)

# Pydantic Model for Input
class EnrichmentRequest(BaseModel):
    company_domain: str
    priority: str = "standard" # 'high' could force API usage immediately

@app.get("/health")
def health_check():
    if hunter_instance:
        return {"status": "healthy", "model": "loaded"}
    return {"status": "degraded", "model": "not_loaded"}

@app.post("/enrich")
async def enrich_company(request: EnrichmentRequest):
    """
    Main Endpoint: 
    1. Receives Company Domain.
    2. Executes Waterfall Search (Scraper -> API).
    3. Runs AI Extraction.
    """
    if not hunter_instance:
        raise HTTPException(status_code=503, detail="AI Service is starting up or failed to load. Please wait.")

    company = request.company_domain
    logger.info(f"🔎 Received Enrichment Request: {company}")

    try:
        # STEP 1: Execute Waterfall Search
        # We pass the waterfall function so the Hunter logic focuses on "Extraction" 
        # while this layer handles "Data Retrieval Strategy".
        raw_evidence = waterfall_search(
            company_domain=company, 
            api_key=GOOGLE_API_KEY, 
            cse_id=GOOGLE_CSE_ID
        )

        if not raw_evidence:
            return {"status": "completed", "data": {}, "message": "No evidence found via Search."}

        # STEP 2: AI Extraction (Using the loaded model)
        # The hunter processes the text snippets we just found
        structured_data = hunter_instance.process_evidence(company, raw_evidence)
        
        return {
            "status": "success", 
            "company": company,
            "technographics": structured_data
        }

    except Exception as e:
        logger.error(f"⚠️ Enrichment Failed for {company}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
