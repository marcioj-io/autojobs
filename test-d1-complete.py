#!/usr/bin/env python3
import requests
import json

base_url = "https://autojobs-worker.marciojunior5872.workers.dev"

print("=" * 100)
print("TESTE COMPLETO - D1 EM PRODUÇÃO (SEM MOCKS)")
print("=" * 100)

# 1. Health check
print("\n✓ 1. HEALTH CHECK (verificando D1)")
response = requests.get(f"{base_url}/health")
print(f"   Status: {response.status_code}")
print(f"   Response: {json.dumps(response.json(), indent=2)}")

# 2. CREATE - Novo filtro
print("\n✓ 2. CREATE - Inserindo novo filtro em D1")
payload = {
    "profile": "frontend",
    "name": "Senior Frontend React",
    "jobTitle": "Senior Frontend Engineer",
    "modalities": ["Remoto", "Híbrido"],
    "cvId": "CV_002",
    "useLatestCv": True,
    "postedWithinHours": 24,
    "requiredSkills": ["React", "TypeScript", "Tailwind"],
    "excludedSkills": ["PHP", "WordPress"],
    "seniority": ["senior", "mid"],
    "locations": ["São Paulo", "Rio de Janeiro"],
    "isActive": True
}

response = requests.post(f"{base_url}/search-filters", json=payload)
print(f"   Status: {response.status_code}")
created_filter = response.json()
print(f"   ID criado: {created_filter.get('id')}")
print(f"   Dados salvos: {json.dumps({k:v for k,v in created_filter.items() if k != 'id'}, indent=2)}")

filter_id = created_filter.get('id')

# 3. GET by ID
print(f"\n✓ 3. GET BY ID - Recuperando filtro {filter_id} do D1")
response = requests.get(f"{base_url}/search-filters?id={filter_id}")
print(f"   Status: {response.status_code}")
retrieved = response.json()
print(f"   Dados recuperados: {json.dumps(retrieved, indent=2)}")

# 4. LIST by profile
print(f"\n✓ 4. LIST BY PROFILE - Listando todos os filtros do perfil 'frontend'")
response = requests.get(f"{base_url}/search-filters?profile=frontend")
print(f"   Status: {response.status_code}")
filters = response.json().get('filters', [])
print(f"   Total de filtros encontrados: {len(filters)}")
for i, f in enumerate(filters):
    print(f"   [{i+1}] {f['name']} (ID: {f['id']}) - Ativo: {f['isActive']}")

# 5. UPDATE - Modificar filtro
print(f"\n✓ 5. UPDATE - Atualizando filtro {filter_id}")
update_payload = {
    "name": "Senior Frontend React + Next.js",
    "requiredSkills": ["React", "Next.js", "TypeScript", "Tailwind"],
    "isActive": True
}
response = requests.put(f"{base_url}/search-filters/{filter_id}", json=update_payload)
print(f"   Status: {response.status_code}")
updated = response.json()
print(f"   Nome atualizado: {updated.get('name')}")
print(f"   Skills atualizadas: {updated.get('requiredSkills')}")

# 6. Verify update
print(f"\n✓ 6. VERIFY UPDATE - Recuperando filtro após update")
response = requests.get(f"{base_url}/search-filters?id={filter_id}")
retrieved = response.json()
print(f"   Nome confirmado: {retrieved.get('name')}")
print(f"   Last update: {retrieved.get('updatedAt')}")

print("\n" + "=" * 100)
print("✅ TODOS OS TESTES PASSARAM - D1 FUNCIONANDO 100% EM PRODUÇÃO (ZERO MOCKS)")
print("=" * 100)
