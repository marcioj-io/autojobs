$ErrorActionPreference = 'Stop'

$WORKER_URL = "https://autojobs-worker.marciojunior5872.workers.dev"
$ENDPOINT = "$WORKER_URL/profiles"

Write-Host "Iniciando carga de perfis..."
Write-Host "Destino: $ENDPOINT"
Write-Host ""

$profiles = @(
    @{
        id = "perfil-unificado-001"
        name = "Desenvolvedor Backend Full Stack"

        searches = @(
            "Desenvolvedor .NET",
            "Desenvolvedor C#",
            "Software Engineer",
            "Backend Software Engineer",
            "Backend Developer",
            "Desenvolvedor Node.js",
            "Node.js Developer",
            "Desenvolvedor TypeScript",
            "Desenvolvedor Full Stack",
            "Full Stack Developer",
            "ASP.NET Core Developer",
            ".NET Software Engineer",
            "API Developer",
            "Software Developer",
            "Frontend Developer",
            "React Developer"
        )

        industries = @(
            "Tecnologia",
            "Tecnologia da Informacao",
            "Engenharia de Software",
            "Arquitetura de Software",
            "Cloud Computing",
            "Inteligencia Artificial",
            "Automacao",
            "Sistemas Financeiros",
            "Transportes",
            "Produto",
            "Plataformas",
            "SaaS",
            "Startups",
            "Consultoria"
        )

        seniorities = @(
            "Pleno",
            "Senior",
            "Pleno/Senior"
        )

        searchLocation = @(
            "Brasil",
            "Sao Paulo"
        )

        allowedModalities = @(
            "Remoto",
            "Hibrido"
        )

        hybridCities = @(
            "Sao Paulo",
            "Osasco"
        )

        negativeKeywords = @(
            "Java",
            "Spring",
            "PHP",
            "Laravel",
            "Ruby",
            "Rails",
            "Angular",
            "Vue",
            "Delphi",
            "Cobol",
            "Estagio",
            "Junior",
            "Presencial",
            "ingles fluente",
            "english fluent"
        )

        minScore = 70
        dailyLimit = 40

        description = "Desenvolvedor Full Stack Pleno com experiencia em C#, .NET, ASP.NET Core, Node.js, TypeScript, React, APIs REST, microsservicos, arquitetura limpa, DDD, SOLID, Docker, AWS, RabbitMQ, Redis, bancos relacionais e projetos de Inteligencia Artificial Generativa com LLMs, RAG, embeddings, busca semantica e automacao de processos."
    }
)

foreach ($profile in $profiles) {

    Write-Host "Enviando perfil: $($profile.name)"

    $jsonPayload = $profile | ConvertTo-Json -Depth 100 -Compress

    try {

        $response = Invoke-RestMethod `
            -Uri $ENDPOINT `
            -Method POST `
            -Headers @{
                "Content-Type" = "application/json"
            } `
            -Body $jsonPayload

        Write-Host "Perfil enviado com sucesso."
        Write-Host ""

        if ($response) {
            $response | ConvertTo-Json -Depth 20
        }

    }
    catch {

        Write-Host "Erro ao enviar perfil."
        Write-Host $_.Exception.Message

        throw
    }
}

Write-Host ""
Write-Host "Seed concluido."