"""
SIGNAL MAP for Atomicwork Technographic Discovery
-------------------------------------------------
This configuration file defines the "Technical Signatures" (Dorks) that the 
Technographic Hunter uses to identify prospects.

Target Domain: ITSM (IT Service Management) & ESM (Enterprise Service Management)
Product Context: Atomicwork (AI-First Service Desk integrated with Teams/Slack)
"""

SIGNAL_MAP = {
    "Atomicwork": {
        "domain_context": "ITSM & Employee Experience",
        
        # CATEGORY 1: COMPETITORS (RIP & REPLACE)
        # Logic: Finding these URLs proves the prospect pays for a competing legacy tool.
        # Action: Trigger "Modernize/Switch" Playbook.
        "competitors": {
            "ServiceNow": [
                'site:service-now.com "employee login" OR "external login"', # Instance discovery
                'site:service-now.com intitle:"ServiceNow" "login"',
                'site:linkedin.com/jobs "experience with ServiceNow" "admin"'
            ],
            "Freshservice": [
                'inurl:freshservice.com/support/login',  # Standard support portal
                'inurl:freshservice.com/support/home',
                'site:freshservice.com "submit a ticket"'
            ],
            "Jira Service Management": [
                'inurl:atlassian.net/servicedesk/customer/user/login', # Customer portal
                'inurl:atlassian.net/servicedesk/customer/portal',
                'site:atlassian.net "service desk" login'
            ],
            "Zendesk": [
                'inurl:zendesk.com/hc/en-us', # Help Center
                'inurl:zendesk.com/agent/login',
                'site:zendesk.com "submit a request"'
            ],
            "SysAid": [
                'inurl:sysaidit.com/Login.jsp',
                'intitle:"SysAid Help Desk" "login"'
            ],
            "Ivanti / Cherwell": [
                'inurl:"/HEAT/Login.aspx"',
                'site:cherwellondemand.com'
            ],
            "HaloITSM": [
                'site:haloitsm.com "login"',
                'inurl:haloitsm.com/portal'
            ]
        },

        # CATEGORY 2: ECOSYSTEM FIT (GREENFIELD)
        # Logic: Atomicwork lives inside MS Teams/Slack. High usage here = High propensity to buy.
        # Action: Trigger "Native Integration" Playbook.
        "ecosystem": {
            "Microsoft Teams": [
                # Looking for deep Teams adoption, not just usage
                'site:linkedin.com/jobs "Microsoft Teams" "deployment" OR "rollout"',
                'site:linkedin.com/jobs "Microsoft Teams" "governance"',
                'site:jobs.lever.co "Microsoft Teams" "collaboration"'
            ],
            "Slack": [
                'site:greenhouse.io "Slack" "admin" OR "integration"',
                'site:linkedin.com/jobs "Slack" "workflows" OR "bot"'
            ],
            "Okta": [
                'inurl:okta.com/login', # Found their Okta tenant
                'inurl:okta.com "sign in"'
            ],
             "Workday": [
                'site:myworkdayjobs.com', # Indicates Enterprise scale (ESM target)
                'inurl:myworkday.com'
            ]
        },

        # CATEGORY 3: PAIN SIGNALS (TRIGGERS)
        # Logic: Explicit intent or dissatisfaction.
        # Action: High Priority Outreach.
        "intent_signals": [
            'site:linkedin.com/jobs "migrating from ServiceNow"',
            'site:linkedin.com/jobs "implementing ITSM"',
            'site:linkedin.com/jobs "service desk manager" "transformation"',
            'site:linkedin.com/jobs "IT support" "automate" "AI"'
        ]
    }
}

# HELPER FUNCTION: Dork Generator
def get_dorks_for_domain(company_domain, category="all"):
    """
    Constructs Google-ready query strings combined with the company domain.
    Usage: get_dorks_for_domain("villageroadshow.com.au", category="competitors")
    """
    signals = SIGNAL_MAP["Atomicwork"]
    generated_dorks = []

    # 1. Competitor Search (Specific URL patterns)
    if category in ["all", "competitors"]:
        for tech, dork_list in signals["competitors"].items():
            for dork in dork_list:
                # If dork is a "site:" search, we combine it with the company name
                if "site:" in dork or "inurl:" in dork:
                    generated_dorks.append(f'"{company_domain}" {dork}')
    
    # 2. Ecosystem Search (Integration fit)
    if category in ["all", "ecosystem"]:
        for tech, dork_list in signals["ecosystem"].items():
            for dork in dork_list:
                generated_dorks.append(f'"{company_domain}" {dork}')

    # 3. Job Description Search (Broad Catch-all)
    # This is the single most effective query for finding what they use in text
    if category in ["all", "general"]:
        generated_dorks.append(
            f'"{company_domain}" (ServiceNow OR Freshservice OR "Jira Service Management" OR "Microsoft Teams") site:linkedin.com/jobs'
        )

    return generated_dorks
