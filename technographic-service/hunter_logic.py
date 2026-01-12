import torch
import json
from transformers import AutoModelForCausalLM, AutoTokenizer
from signal_map import get_dorks_for_domain

VALID_TECHS = ["ServiceNow", "Freshservice", "Jira Service Management", "Microsoft Teams", "Slack", "Okta", "Zendesk", "SysAid", "Workday"]

class TechnographicHunter:
    def __init__(self, load_4bit=True):
        model_id = "numind/NuExtract-1.5"
        
        print(f"⚙️ Loading Extraction Model: {model_id} (4-bit: {load_4bit})...")
        # Enterprise-Grade Loading: Use 4-bit to save RAM
        self.tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_id,
            trust_remote_code=True,
            device_map="auto",
            load_in_4bit=load_4bit, # Requires bitsandbytes
            torch_dtype=torch.bfloat16
        )
        self.model.eval()

    def _extract_with_model(self, text_snippet):
        """
        Uses NuExtract to pull tools from text into strict JSON.
        """
        schema = """{
            "technologies": ["List of software tools mentioned"],
            "context": "How is the tool used? (e.g., 'Currently migrating from', 'Experience with')"
        }"""
        
        prompt = f"""<|input|>
### Template:
{schema}

### Text:
{text_snippet}

<|output|>
"""
        
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.model.device)
        with torch.no_grad():
            outputs = self.model.generate(**inputs, max_new_tokens=500, temperature=0.1)
            
        result_text = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        # Parse the JSON from the output (Logic to strip the prompt)
        try:
            json_str = result_text.split("<|output|>")[-1].strip()
            return json.loads(json_str)
        except:
            return {"technologies": []}

    def _verify_evidence(self, extracted_techs, raw_text):
        """
        ZERO HALLUCINATION LAYER:
        If the extracted word does not exist in the raw text, reject it.
        """
        verified = []
        for tech in extracted_techs:
            # Check for hallucination
            if tech.lower() not in raw_text.lower():
                continue
            
            # CRM Normalization
            normalized_tech = next((t for t in VALID_TECHS if t.lower() in tech.lower()), None)
            if normalized_tech:
                verified.append(normalized_tech)
                
        return list(set(verified)) # Deduplicate

    def process_evidence(self, company_name, text_snippets):
        """
        Takes raw text from the Search Layer and runs the Extraction Model.
        """
        evidence_locker = {}
        
        for snippet in text_snippets:
            # 1. Run AI Extraction (NuExtract)
            extracted_data = self._extract_with_model(snippet)
            candidates = extracted_data.get("technologies", [])
            
            # 2. Verify (Zero Hallucination)
            valid_tools = self._verify_evidence(candidates, snippet)
            
            for tool in valid_tools:
                # Deduplicate and Store
                if tool not in evidence_locker:
                    evidence_locker[tool] = {
                        "tech_name": tool,
                        "category": "Detected", # You can enhance this with your Signal Map logic if passed
                        "confidence": "VERIFIED_CONTEXT",
                        "evidence": snippet[:200] + "..." # Store snippet for Audit
                    }
                    
        # Return as list for simpler JSON consumption
        return list(evidence_locker.values())
