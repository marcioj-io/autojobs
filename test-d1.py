#!/usr/bin/env python3
import requests
import json

url = "https://autojobs-worker.marciojunior5872.workers.dev/search-filters"
payload = {
    "profile": "backend",
    "name": "Senior Backend - Remote",
    "jobTitle": "Senior Backend Engineer",
    "modalities": ["Remoto"],
    "cvId": "CV_001",
    "useLatestCv": True,
    "postedWithinHours": 24,
    "requiredSkills": ["Node.js", "TypeScript", "PostgreSQL"],
    "excludedSkills": ["PHP", "WordPress"],
    "seniority": ["senior"],
    "locations": ["São Paulo", "Remote"],
    "isActive": True
}

print("=" * 80)
print("TESTE DE PRODUÇÃO - D1 CLOUDFLARE")
print("=" * 80)
print(f"\n🚀 URL: {url}")
print(f"📝 Payload:\n{json.dumps(payload, indent=2)}\n")

response = requests.post(url, json=payload)

print(f"✅ Status Code: {response.status_code}")
print(f"📦 Response:\n{json.dumps(response.json(), indent=2)}\n")

# Get the filter ID
if response.status_code == 201:
    filter_id = response.json().get('id')
    print(f"✓ Filter criado com ID: {filter_id}")
    
    # Test GET
    print("\n" + "=" * 80)
    print("TESTE GET - RECUPERANDO FILTRO DO D1")
    print("=" * 80)
    get_url = f"https://autojobs-worker.marciojunior5872.workers.dev/search-filters?id={filter_id}"
    get_response = requests.get(get_url)
    print(f"\n🔍 URL: {get_url}")
    print(f"✅ Status Code: {get_response.status_code}")
    print(f"📦 Response:\n{json.dumps(get_response.json(), indent=2)}\n")
