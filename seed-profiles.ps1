$ErrorActionPreference = 'Stop'

# 🌐 URL DA SUA API (Worker)
$WORKER_URL = "https://autojobs-worker.marciojunior5872.workers.dev"
$ENDPOINT = "$WORKER_URL/profiles"

Write-Host "Iniciando carga do perfil unificado..." -ForegroundColor Cyan
Write-Host "Destino: $ENDPOINT`n" -ForegroundColor DarkGray

# 📦 DADOS ESTRUTURADOS (Hashtables do PowerShell)
$profiles = @(
    @{
        id = "perfil-unificado-001"
        name = "Desenvolvedor Backend/Full Stack"
        
        searches = @(
            "Desenvolvedor .NET", "Desenvolvedor C#", "Engenheiro de Software .NET", "Software Engineer", 
            "Backend Software Engineer", "Backend Developer C#", "Backend Developer", "Desenvolvedor Node.js", 
            "Backend Node.js", "Node.js Developer", "Desenvolvedor TypeScript", "Engenheiro Backend Node", 
            "Desenvolvedor Full Stack", "Full Stack Developer", "Full Stack Software Engineer", 
            "Engenheiro Full Stack", "Full Stack React", "ASP.NET Core Developer", ".NET Software Engineer", 
            "API Developer", "Application Developer", "Desenvolvedor de Software", "Software Developer", 
            "Frontend Developer", "React Developer"
        )
        
        industries = @(
            "Tecnologia", "Tecnologia da Informação", "Engenharia de Software", "Arquitetura de Software", 
            "Cloud Computing", "Inteligência Artificial", "Automação", "Sistemas Financeiros", "Transportes", 
            "Produto", "Plataformas", "SaaS", "Startups", "Consultoria"
        )
        
        seniorities = @(
            "Pleno", "Senior", "Pleno/Senior"
        )
        
        searchLocation = @(
            "Brasil", "São Paulo"
        )
        
        allowedModalities = @(
            "Remoto", "Híbrido"
        )
        
        hybridCities = @(
            "São Paulo", "Osasco"
        )

        skills = @{
            backend = @{
                tools = @("C#", ".NET", "ASP.NET Core", "Web API", "Entity Framework Core", "LINQ", "Clean Architecture", "DDD", "SOLID", "TDD", "Repository Pattern", "Dependency Injection", "Microservices", "REST", "gRPC", "NestJS", "Express", "JWT", "Swagger", "OpenAPI", "Middleware", "Authentication", "Authorization")
                years = 5
                level = "especialista"
            }
            database = @{
                tools = @("SQL", "SQL Server", "PostgreSQL", "MySQL", "SQLite", "MongoDB", "Redis", "Entity Framework Core", "EF Core Migrations", "Database Modeling", "Query Optimization")
                years = 5
                level = "avançado"
            }
            frontend = @{
                tools = @("React", "TypeScript", "JavaScript", "Redux", "Zustand", "React Hooks", "Material UI", "TailwindCSS", "Zod", "Axios", "HTML", "CSS")
                years = 5
                level = "avançado"
            }
            infra = @{
                tools = @("Docker", "Docker Compose", "AWS", "EC2", "RDS", "S3", "Cloudflare", "RabbitMQ", "Git", "Azure DevOps", "CI/CD")
                years = 5
                level = "avançado"
            }
            cloud = @{
                tools = @("AWS", "EC2", "RDS", "S3", "Cloudflare", "Docker", "Docker Compose", "CI/CD")
                years = 5
                level = "avançado"
            }
            artificialIntelligence = @{
                tools = @("LLM", "Generative AI", "RAG", "Retrieval-Augmented Generation", "Embeddings", "Vector Search", "Semantic Search", "FAISS", "Sentence Transformers", "Prompt Engineering", "Ollama", "llama.cpp", "Mistral", "GPT4All", "Python", "FastAPI", "AI Orchestration", "Context Retrieval")
                years = 2
                level = "avançado"
            }
            automation = @{
                tools = @("Playwright", "Web Scraping", "Browser Automation", "Data Extraction", "Crawler", "Automation Scripts", "ETL", "Data Processing")
                years = 4
                level = "avançado"
            }
            architecture = @{
                tools = @("Clean Architecture", "DDD", "SOLID", "Microservices", "Layered Architecture", "Repository Pattern", "Dependency Injection", "Software Architecture", "API Design")
                years = 5
                level = "avançado"
            }
            security = @{
                tools = @("JWT", "CORS", "SQL Injection Prevention", "XSS Prevention", "CSRF Protection", "Authentication", "Authorization", "OWASP", "Input Validation")
                years = 5
                level = "avançado"
            }
            dataEngineering = @{
                tools = @("Data Pipelines", "Data Processing", "Data Normalization", "Information Retrieval", "Text Processing", "Document Processing", "Indexing")
                years = 3
                level = "avançado"
            }
        }

        languages = @{
            "Português" = "Nativo"
            "Inglês" = "B1"
        }
        
        negativeKeywords = @(
            "Estágio", "Júnior", "Sênior", "Java", "Spring", "PHP", "Laravel", "Ruby", "Rails", "Angular", 
            "Vue", "Delphi", "Cobol", "Django", "Flask", "Presencial", "specialist", "especialista", "sr", 
            "jr", "tech lead", "lead", "trainee"
        )
        
        minScore = 70
        dailyLimit = 40
        
        description = "Desenvolvedor Full Stack nível Pleno com sólida experiência em desenvolvimento de software para sistemas corporativos, aplicações de missão crítica e plataformas de alto desempenho, atuando principalmente com C#, .NET, ASP.NET Core, Entity Framework Core, Node.js, TypeScript e React. Experiência profissional em projetos dos segmentos financeiro, transporte público, mídia digital, empregabilidade e educação, desenvolvendo soluções escaláveis, seguras e orientadas à qualidade. Experiência prática na construção de APIs REST, microsserviços, integrações entre sistemas, processamento assíncrono, filas de mensagens (RabbitMQ), cache distribuído (Redis), autenticação JWT, autorização baseada em perfis, versionamento de APIs, middlewares, tratamento global de exceções, validações, documentação com Swagger/OpenAPI e desenvolvimento de aplicações seguindo boas práticas de engenharia de software. Conhecimento sólido em Clean Architecture, Domain-Driven Design (DDD), SOLID, TDD, Injeção de Dependência, Repository Pattern, Service Layer, princípios de baixo acoplamento, alta coesão, arquitetura em camadas, modularização e desenvolvimento orientado à manutenção, escalabilidade e legibilidade. Experiência com Entity Framework Core utilizando migrations, consultas otimizadas, LINQ, mapeamento de entidades, relacionamentos complexos, otimização de consultas e modelagem de bancos relacionais. Atua também com SQL Server, PostgreSQL, MongoDB, Redis, MySQL e SQLite. Experiência Full Stack utilizando React, TypeScript, JavaScript, React Hooks, Redux, Zustand, Material UI, TailwindCSS, Zod, consumo de APIs REST, gerenciamento de estado, componentização, formulários, validações e construção de interfaces modernas. Experiência em infraestrutura utilizando Docker, Docker Compose, AWS (EC2, RDS e S3), Cloudflare, Git, Azure DevOps, CI/CD, configuração de ambientes de desenvolvimento e produção, deploy de aplicações e integração contínua. Experiência profissional desenvolvendo aplicações com foco em desempenho, disponibilidade, segurança e confiabilidade, participando desde análise de requisitos até implementação, integração, manutenção, correção de problemas e evolução contínua de produtos. Possui forte experiência no desenvolvimento de automações, scripts, processamento de dados, web scraping, browser automation, extração de informações estruturadas e não estruturadas, normalização de dados, integração entre serviços, construção de pipelines de processamento e ferramentas internas para ganho de produtividade. Desenvolve projetos pessoais avançados voltados para Inteligência Artificial Generativa, Large Language Models (LLMs), Retrieval-Augmented Generation (RAG), busca semântica, embeddings, bancos vetoriais e arquiteturas orientadas à IA. Experiência prática no desenvolvimento de uma plataforma RAG composta por múltiplos microserviços desacoplados responsáveis pela geração de embeddings, armazenamento vetorial utilizando FAISS, recuperação semântica de documentos, integração com Jira e Confluence, orquestração de modelos de linguagem e geração contextualizada de respostas utilizando modelos locais como Mistral, llama.cpp, GPT4All e Ollama. Conhecimento prático em Python e FastAPI para desenvolvimento de serviços de IA, criação de APIs para inferência de modelos locais, processamento de documentos, geração de embeddings, integração entre serviços e automação de pipelines relacionados à Inteligência Artificial. Experiência prática trabalhando com arquitetura de aplicações baseadas em IA envolvendo recuperação de contexto, indexação vetorial, engenharia de prompts, processamento de documentos, chunking, embeddings semânticos, orquestração entre LLMs, recuperação Top-K, integração entre múltiplos provedores de IA e construção de assistentes inteligentes para ambientes corporativos. Conhecimento em processamento de linguagem natural (NLP), mecanismos de busca semântica, recuperação de informação, análise de documentos corporativos, automação de consultas e integração entre diferentes fontes de dados. Perfil com facilidade para compreender regras de negócio complexas, projetar soluções escaláveis, integrar diferentes tecnologias e desenvolver aplicações com foco em performance, segurança, qualidade de código, reutilização e boas práticas de engenharia. Busca oportunidades como Desenvolvedor .NET, Desenvolvedor C#, Backend Developer, Software Engineer, Node.js Developer ou Full Stack Developer em empresas que trabalhem com arquitetura moderna, microsserviços, cloud computing, produtos digitais, automação, engenharia de software, plataformas escaláveis e Inteligência Artificial aplicada aos negócios. Rejeitar vagas destinadas exclusivamente às tecnologias Java/Spring, PHP/Laravel, Ruby/Rails, Angular, Vue, Delphi, Cobol ou outras stacks fora do foco principal. Rejeitar vagas exclusivamente presenciais e vagas destinadas aos níveis Estágio, Júnior ou Sênior."
    }
)

# 🔄 LOOP DE INSERÇÃO
foreach ($profile in $profiles) {
    Write-Host "Enviando perfil: " -NoNewline
    Write-Host "[$($profile.name)]" -ForegroundColor Yellow
    
    # O Depth 100 garante que dados aninhados (como o bloco 'skills') convertam para JSON corretamente
    $jsonPayload = $profile | ConvertTo-Json -Depth 100
    
    try {
        $response = Invoke-RestMethod `
            -Uri $ENDPOINT `
            -Method POST `
            -Headers @{
                "Content-Type" = "application/json; charset=utf-8"
            } `
            -Body ([System.Text.Encoding]::UTF8.GetBytes($jsonPayload))

        Write-Host "✅ Perfil enviado com sucesso!" -ForegroundColor Green
        Write-Host ""

        if ($response) {
            $response | ConvertTo-Json -Depth 20 | Write-Host -ForegroundColor DarkGray
        }
    }
    catch {
        Write-Host "❌ Erro ao enviar perfil." -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        throw
    }
}

Write-Host "`n🚀 Seed concluído!" -ForegroundColor Cyan