import logging
import time
import random
import requests
from googlesearch import search as google_scraper # pip install googlesearch-python

logger = logging.getLogger("SearchUtils")

def waterfall_search(company_domain: str, api_key: str = "", cse_id: str = ""):
    """
    THE WATERFALL STRATEGY:
    1. Attempt Free Scraper (googlesearch-python).
    2. If Rate Limited (429) or Failed -> Fallback to Google Custom Search API.
    3. Return list of raw text snippets (or URLs).
    """
    
    # 1. Generate Dorks (Importing your Signal Map logic here)
    from signal_map import get_dorks_for_domain
    queries = get_dorks_for_domain(company_domain, category="all")
    
    aggregated_results = []
    seen_urls = set()

    # --- STRATEGY A: FREE SCRAPER ---
    try:
        logger.info(f"🕵️ Attempting Free Scraper for {company_domain}...")
        
        for q in queries:
            # Random delay to be polite to Google
            time.sleep(random.uniform(1.5, 3.5)) 
            
            # num_results=3 is safe-ish. 
            # advanced=True gets us the 'description' (snippet) which is crucial.
            scraper_results = google_scraper(q, num_results=3, advanced=True)
            
            for res in scraper_results:
                if res.url not in seen_urls:
                    # We store the snippet because that's what the AI reads
                    aggregated_results.append(res.description) 
                    seen_urls.add(res.url)
        
        if aggregated_results:
            logger.info(f"✅ Scraper Success: Found {len(aggregated_results)} snippets.")
            return aggregated_results

    except Exception as e:
        logger.warning(f"⚠️ Scraper Failed (likely Rate Limit): {str(e)}")
        # PROCEED TO FALLBACK...

    # --- STRATEGY B: PAID API FALLBACK ---
    if not api_key or not cse_id:
        logger.error("❌ API Fallback Skipped: Missing GOOGLE_API_KEY or CSE_ID.")
        return []

    try:
        logger.info(f"💳 Switching to Google Custom Search API for {company_domain}...")
        
        for q in queries:
            # Google CSE API Endpoint
            url = "https://www.googleapis.com/customsearch/v1"
            params = {
                'key': api_key,
                'cx': cse_id,
                'q': q,
                'num': 3 
            }
            
            resp = requests.get(url, params=params)
            
            if resp.status_code == 200:
                data = resp.json()
                for item in data.get('items', []):
                    link = item.get('link')
                    snippet = item.get('snippet', '')
                    
                    if link not in seen_urls:
                        aggregated_results.append(snippet)
                        seen_urls.add(link)
            elif resp.status_code == 429:
                logger.error("❌ API Rate Limit Exceeded.")
                break
            else:
                logger.error(f"❌ API Error {resp.status_code}: {resp.text}")

        logger.info(f"✅ API Search Completed: Found {len(aggregated_results)} snippets.")
        return aggregated_results

    except Exception as e:
        logger.error(f"❌ API Fallback Failed: {str(e)}")
        return []
