/**
 * ═══════════════════════════════════════════════════════════════════
 *  ATS RESUME ANALYZER SERVICE  (v2 — robust PDF handling)
 *  Pipeline: Parse → Normalize → Extract → Match → Score → Recommend
 * ═══════════════════════════════════════════════════════════════════
 */

import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getAllGeminiKeys, getAllGroqKeys, getOpenRouterKey } from "./aiChain";
import { fetchJson } from "./http";

const cjsRequire = createRequire(import.meta.url);

// ── Config ──────────────────────────────────────────────────────
const EMBEDDING_MODEL = "gemini-embedding-001";

// getAllGeminiKeys & getGeminiKey are now imported from aiChain.ts
function getGeminiKey(): string {
    const keys = getAllGeminiKeys();
    if (keys.length === 0) throw new Error("No Gemini API key configured");
    return keys[0];
}

// ═══════════════════════════════════════════════════════════════════
//  COMPREHENSIVE SKILLS DATABASE
//  Each entry: { canonical name, aliases/variations to search for }
// ═══════════════════════════════════════════════════════════════════

interface SkillDef {
    name: string;          // Display name
    patterns: string[];    // All patterns to search (lowercase)
}

const TECH_SKILLS_DB: SkillDef[] = [
    // Programming Languages
    { name: "Python", patterns: ["python"] },
    { name: "Java", patterns: ["java", "j2ee", "jvm"] },
    { name: "JavaScript", patterns: ["javascript", "js", "ecmascript"] },
    { name: "TypeScript", patterns: ["typescript"] },
    { name: "C++", patterns: ["c++", "cpp"] },
    { name: "C#", patterns: ["c#", "csharp", "c sharp"] },
    { name: "C Language", patterns: ["c programming", "c language"] },
    { name: "Ruby", patterns: ["ruby"] },
    { name: "Go", patterns: ["golang", "go language", "go programming"] },
    { name: "Rust", patterns: ["rust"] },
    { name: "Swift", patterns: ["swift"] },
    { name: "Kotlin", patterns: ["kotlin"] },
    { name: "Scala", patterns: ["scala"] },
    { name: "Perl", patterns: ["perl"] },
    { name: "PHP", patterns: ["php"] },
    { name: "R", patterns: ["r programming", "r language", "r studio", "rstudio"] },
    { name: "MATLAB", patterns: ["matlab"] },
    { name: "Dart", patterns: ["dart"] },
    { name: "Lua", patterns: ["lua"] },
    { name: "VBA", patterns: ["vba", "visual basic"] },
    { name: "Bash/Shell", patterns: ["bash", "shell scripting", "shell script"] },
    { name: "PowerShell", patterns: ["powershell"] },

    // Web Frontend
    { name: "HTML", patterns: ["html", "html5"] },
    { name: "CSS", patterns: ["css", "css3", "stylesheet"] },
    { name: "SASS/SCSS", patterns: ["sass", "scss"] },
    { name: "Tailwind CSS", patterns: ["tailwind", "tailwindcss"] },
    { name: "Bootstrap", patterns: ["bootstrap"] },
    { name: "React", patterns: ["react", "reactjs", "react.js", "react js"] },
    { name: "Angular", patterns: ["angular", "angularjs", "angular.js"] },
    { name: "Vue.js", patterns: ["vue", "vuejs", "vue.js", "vue js"] },
    { name: "Svelte", patterns: ["svelte"] },
    { name: "Next.js", patterns: ["next.js", "nextjs", "next js"] },
    { name: "Nuxt.js", patterns: ["nuxt", "nuxtjs"] },
    { name: "Gatsby", patterns: ["gatsby"] },
    { name: "jQuery", patterns: ["jquery"] },
    { name: "Webpack", patterns: ["webpack"] },
    { name: "Vite", patterns: ["vite"] },

    // Web Backend
    { name: "Node.js", patterns: ["node.js", "nodejs", "node js"] },
    { name: "Express.js", patterns: ["express", "expressjs", "express.js"] },
    { name: "NestJS", patterns: ["nestjs", "nest.js"] },
    { name: "Django", patterns: ["django"] },
    { name: "Flask", patterns: ["flask"] },
    { name: "FastAPI", patterns: ["fastapi", "fast api"] },
    { name: "Spring Boot", patterns: ["spring boot", "springboot", "spring framework"] },
    { name: "Spring", patterns: ["spring"] },
    { name: "Laravel", patterns: ["laravel"] },
    { name: "Ruby on Rails", patterns: ["ruby on rails", "rails"] },
    { name: ".NET", patterns: [".net", "dotnet", "asp.net"] },

    // Databases
    { name: "SQL", patterns: ["sql"] },
    { name: "MySQL", patterns: ["mysql"] },
    { name: "PostgreSQL", patterns: ["postgresql", "postgres"] },
    { name: "MongoDB", patterns: ["mongodb", "mongo db", "mongo"] },
    { name: "SQLite", patterns: ["sqlite"] },
    { name: "Oracle DB", patterns: ["oracle"] },
    { name: "Redis", patterns: ["redis"] },
    { name: "Cassandra", patterns: ["cassandra"] },
    { name: "DynamoDB", patterns: ["dynamodb"] },
    { name: "MariaDB", patterns: ["mariadb"] },
    { name: "Neo4j", patterns: ["neo4j"] },
    { name: "GraphQL", patterns: ["graphql"] },
    { name: "Elasticsearch", patterns: ["elasticsearch", "elastic search"] },
    { name: "Firebase", patterns: ["firebase"] },
    { name: "Supabase", patterns: ["supabase"] },

    // Cloud & DevOps
    { name: "AWS", patterns: ["aws", "amazon web services", "amazon cloud"] },
    { name: "Azure", patterns: ["azure", "microsoft azure"] },
    { name: "GCP", patterns: ["gcp", "google cloud", "google cloud platform"] },
    { name: "Docker", patterns: ["docker", "containerization"] },
    { name: "Kubernetes", patterns: ["kubernetes", "k8s"] },
    { name: "Terraform", patterns: ["terraform"] },
    { name: "Ansible", patterns: ["ansible"] },
    { name: "Jenkins", patterns: ["jenkins"] },
    { name: "CI/CD", patterns: ["ci/cd", "cicd", "ci cd", "continuous integration", "continuous deployment"] },
    { name: "GitHub Actions", patterns: ["github actions"] },
    { name: "GitLab CI", patterns: ["gitlab ci", "gitlab-ci"] },
    { name: "Nginx", patterns: ["nginx"] },
    { name: "Apache", patterns: ["apache server", "apache http"] },
    { name: "Heroku", patterns: ["heroku"] },
    { name: "Vercel", patterns: ["vercel"] },
    { name: "Netlify", patterns: ["netlify"] },
    { name: "Prometheus", patterns: ["prometheus"] },
    { name: "Grafana", patterns: ["grafana"] },

    // Data & ML/AI
    { name: "Machine Learning", patterns: ["machine learning", "ml model", "ml pipeline"] },
    { name: "Deep Learning", patterns: ["deep learning"] },
    { name: "Artificial Intelligence", patterns: ["artificial intelligence"] },
    { name: "TensorFlow", patterns: ["tensorflow", "tensor flow"] },
    { name: "PyTorch", patterns: ["pytorch"] },
    { name: "Keras", patterns: ["keras"] },
    { name: "Scikit-learn", patterns: ["scikit-learn", "scikit learn", "sklearn"] },
    { name: "Pandas", patterns: ["pandas"] },
    { name: "NumPy", patterns: ["numpy"] },
    { name: "Data Science", patterns: ["data science", "data scientist"] },
    { name: "Data Analysis", patterns: ["data analysis", "data analyst", "data analytics"] },
    { name: "Data Engineering", patterns: ["data engineering", "data engineer"] },
    { name: "Data Visualization", patterns: ["data visualization", "data viz"] },
    { name: "NLP", patterns: ["nlp", "natural language processing", "natural language"] },
    { name: "Computer Vision", patterns: ["computer vision"] },
    { name: "Neural Networks", patterns: ["neural network", "neural networks"] },
    { name: "Hadoop", patterns: ["hadoop"] },
    { name: "Apache Spark", patterns: ["spark", "apache spark", "pyspark"] },
    { name: "Kafka", patterns: ["kafka", "apache kafka"] },
    { name: "Tableau", patterns: ["tableau"] },
    { name: "Power BI", patterns: ["power bi", "powerbi"] },
    { name: "LLM", patterns: ["llm", "large language model"] },
    { name: "GPT", patterns: ["gpt", "chatgpt"] },
    { name: "BERT", patterns: ["bert"] },
    { name: "Generative AI", patterns: ["generative ai", "genai", "gen ai"] },
    { name: "LangChain", patterns: ["langchain"] },
    { name: "RAG", patterns: ["rag", "retrieval augmented"] },
    { name: "Big Data", patterns: ["big data"] },
    { name: "ETL", patterns: ["etl"] },

    // Mobile
    { name: "Android", patterns: ["android"] },
    { name: "iOS", patterns: ["ios", "iphone", "ipad"] },
    { name: "React Native", patterns: ["react native"] },
    { name: "Flutter", patterns: ["flutter"] },
    { name: "Xamarin", patterns: ["xamarin"] },
    { name: "Ionic", patterns: ["ionic"] },
    { name: "SwiftUI", patterns: ["swiftui"] },
    { name: "Expo", patterns: ["expo"] },
    { name: "Mobile Development", patterns: ["mobile development", "mobile app", "mobile application"] },

    // Tools
    { name: "Git", patterns: ["git", "github", "gitlab", "bitbucket"] },
    { name: "Jira", patterns: ["jira"] },
    { name: "Confluence", patterns: ["confluence"] },
    { name: "Figma", patterns: ["figma"] },
    { name: "Postman", patterns: ["postman"] },
    { name: "Swagger", patterns: ["swagger", "openapi"] },
    { name: "Linux", patterns: ["linux", "ubuntu", "centos", "debian"] },
    { name: "REST API", patterns: ["rest api", "restful", "rest ful"] },
    { name: "API Development", patterns: ["api development", "api design", "web api"] },
    { name: "Microservices", patterns: ["microservices", "micro services", "micro-services"] },
    { name: "gRPC", patterns: ["grpc"] },
    { name: "WebSocket", patterns: ["websocket", "web socket"] },
    { name: "OAuth", patterns: ["oauth"] },
    { name: "JWT", patterns: ["jwt", "json web token"] },

    // Methodologies
    { name: "Agile", patterns: ["agile"] },
    { name: "Scrum", patterns: ["scrum"] },
    { name: "DevOps", patterns: ["devops", "dev ops"] },
    { name: "Unit Testing", patterns: ["unit testing", "unit test"] },
    { name: "TDD", patterns: ["tdd", "test driven development", "test-driven development"] },
    { name: "Selenium", patterns: ["selenium"] },
    { name: "Cypress", patterns: ["cypress"] },
    { name: "Jest", patterns: ["jest"] },
    { name: "Playwright", patterns: ["playwright"] },

    // Other Tech
    { name: "Blockchain", patterns: ["blockchain", "block chain"] },
    { name: "Ethereum", patterns: ["ethereum"] },
    { name: "Solidity", patterns: ["solidity"] },
    { name: "Web3", patterns: ["web3"] },
    { name: "Cybersecurity", patterns: ["cybersecurity", "cyber security", "information security"] },
    { name: "Embedded Systems", patterns: ["embedded system", "embedded systems"] },
    { name: "IoT", patterns: ["internet of things"] },
    { name: "AR/VR", patterns: ["augmented reality", "virtual reality"] },
    { name: "Unity", patterns: ["unity"] },
    { name: "SVM", patterns: ["svm", "support vector machine"] },
    { name: "Random Forest", patterns: ["random forest"] },
    { name: "XGBoost", patterns: ["xgboost"] },
    { name: "SAP", patterns: ["sap"] },
    { name: "AutoCAD", patterns: ["autocad", "auto cad"] },
    { name: "SolidWorks", patterns: ["solidworks", "solid works"] },
    { name: "VLSI", patterns: ["vlsi"] },
    { name: "PLC", patterns: ["plc"] },
    { name: "Salesforce", patterns: ["salesforce"] },
    { name: "CRM", patterns: ["crm"] },
    { name: "ERP", patterns: ["erp"] },
    { name: "Photoshop", patterns: ["photoshop"] },
    { name: "Illustrator", patterns: ["illustrator"] },
    { name: "Adobe XD", patterns: ["adobe xd"] },
    { name: "UI/UX", patterns: ["ui/ux", "ui ux", "ux design", "ui design", "user experience", "user interface design"] },
    { name: "Responsive Design", patterns: ["responsive design", "responsive web"] },
    { name: "Full Stack", patterns: ["full stack", "fullstack", "full-stack"] },
    { name: "Frontend", patterns: ["frontend", "front-end", "front end"] },
    { name: "Backend", patterns: ["backend", "back-end", "back end"] },
    { name: "OOP", patterns: ["object oriented", "object-oriented", "oop"] },
    { name: "Data Structures", patterns: ["data structure", "data structures"] },
    { name: "Algorithms", patterns: ["algorithm", "algorithms"] },
    { name: "Design Patterns", patterns: ["design pattern", "design patterns"] },
    { name: "System Design", patterns: ["system design"] },
    { name: "Cloud Computing", patterns: ["cloud computing", "cloud infrastructure", "cloud services"] },
    { name: "Networking", patterns: ["networking", "network engineering", "network administration"] },
    { name: "Information Security", patterns: ["information security", "infosec"] },
    { name: "Penetration Testing", patterns: ["penetration testing", "pen testing", "pentest"] },
    { name: "Ethical Hacking", patterns: ["ethical hacking"] },
    { name: "Automation", patterns: ["automation", "process automation"] },
    { name: "Scripting", patterns: ["scripting"] },
    { name: "Version Control", patterns: ["version control"] },
    { name: "Database Management", patterns: ["database management", "database administration", "dba"] },
    { name: "Windows", patterns: ["windows server", "windows administration"] },
    { name: "Virtualization", patterns: ["virtualization", "vmware", "virtual machine"] },
];

const SOFT_SKILLS_DB: SkillDef[] = [
    { name: "Leadership", patterns: ["leadership", "team lead", "team leader", "led a team"] },
    { name: "Communication", patterns: ["communication", "communicator", "communicate"] },
    { name: "Teamwork", patterns: ["teamwork", "team work", "team player", "collaboration", "collaborative"] },
    { name: "Problem Solving", patterns: ["problem solving", "problem-solving", "troubleshooting"] },
    { name: "Critical Thinking", patterns: ["critical thinking", "analytical thinking"] },
    { name: "Project Management", patterns: ["project management", "project manager", "project lead"] },
    { name: "Time Management", patterns: ["time management", "deadline", "deadlines"] },
    { name: "Attention to Detail", patterns: ["attention to detail", "detail oriented", "detail-oriented", "meticulous"] },
    { name: "Adaptability", patterns: ["adaptability", "adaptable", "flexible", "flexibility"] },
    { name: "Creativity", patterns: ["creativity", "creative", "innovative", "innovation"] },
    { name: "Presentation", patterns: ["presentation", "presenting", "public speaking"] },
    { name: "Mentoring", patterns: ["mentoring", "mentorship", "coaching"] },
    { name: "Negotiation", patterns: ["negotiation", "negotiating"] },
    { name: "Strategic Thinking", patterns: ["strategic thinking", "strategic planning", "strategy"] },
    { name: "Customer Service", patterns: ["customer service", "client management", "client facing"] },
    { name: "Stakeholder Management", patterns: ["stakeholder management", "stakeholder"] },
    { name: "Decision Making", patterns: ["decision making", "decision-making"] },
    { name: "Self-Motivated", patterns: ["self-motivated", "self motivated", "self-starter", "proactive"] },
    { name: "Technical Writing", patterns: ["technical writing", "documentation"] },
    { name: "Risk Management", patterns: ["risk management", "risk assessment"] },
];

// ═══════════════════════════════════════════════════════════════════
//  1. PDF TEXT EXTRACTION
// ═══════════════════════════════════════════════════════════════════

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
    // pdf-parse v1.1.1: import from lib/pdf-parse.js directly to bypass
    // index.js debug-mode check (!module.parent is true in tsx/ESM)
    const pdfParse = cjsRequire("pdf-parse/lib/pdf-parse.js");
    const result = await pdfParse(buffer);
    return result.text;
}

/**
 * Normalize text extracted from PDFs:
 * - Remove special chars but keep key punctuation (+, #, /, .)
 * - Collapse whitespace
 * - Lowercase
 */
function normalizeText(text: string): string {
    return text
        .replace(/[\r\n\t]+/g, " ")           // newlines → space
        .replace(/[^\w\s.+#/\-@&]/g, " ")     // keep word chars, dots, +, #, /, -, @, &
        .replace(/\s+/g, " ")                  // collapse whitespace
        .trim()
        .toLowerCase();
}

// ═══════════════════════════════════════════════════════════════════
//  2. SKILL EXTRACTION  (robust — pattern matching with normalization)
// ═══════════════════════════════════════════════════════════════════

function findSkills(text: string, db: SkillDef[]): string[] {
    const normalized = normalizeText(text);
    const found: string[] = [];

    for (const skillDef of db) {
        for (const pattern of skillDef.patterns) {
            // For short patterns (≤3 chars), require word boundaries more strictly
            if (pattern.length <= 2) continue; // Skip 1-2 char patterns always

            let matched = false;
            if (pattern.length <= 3) {
                // Short patterns: exact word boundary match
                const regex = new RegExp(`(?:^|[\\s,;.(/])${escapeRegex(pattern)}(?:[\\s,;.)/]|$)`, "i");
                matched = regex.test(normalized);
            } else {
                // Longer patterns: more relaxed matching (handles PDF spacing issues)
                matched = normalized.includes(pattern);
            }

            if (matched) {
                found.push(skillDef.name);
                break; // Found at least one pattern for this skill, move to next
            }
        }
    }

    return [...new Set(found)].sort();
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractSkills(text: string): { techSkills: string[]; softSkills: string[] } {
    return {
        techSkills: findSkills(text, TECH_SKILLS_DB),
        softSkills: findSkills(text, SOFT_SKILLS_DB),
    };
}

// ═══════════════════════════════════════════════════════════════════
//  3. GEMINI EMBEDDINGS — Semantic Matching
// ═══════════════════════════════════════════════════════════════════

async function generateEmbedding(text: string): Promise<number[]> {
    const genAI = new GoogleGenerativeAI(getGeminiKey());
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent(text.slice(0, 8000));
    return result.embedding.values;
}

function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
}

// ═══════════════════════════════════════════════════════════════════
//  4. RESUME CATEGORY CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════

let _categories: string[] | null = null;

function loadCategories(): string[] {
    if (_categories) return _categories;
    try {
        const catPath = path.join(__dirname, "..", "..", "..", "ml", "models", "resume_categories.json");
        if (fs.existsSync(catPath)) {
            _categories = JSON.parse(fs.readFileSync(catPath, "utf-8"));
            return _categories!;
        }
    } catch { }
    _categories = [
        "Advocate", "Arts", "Automation Testing", "Blockchain",
        "Business Analyst", "Civil Engineer", "Data Science",
        "Database", "DevOps Engineer", "DotNet Developer",
        "ETL Developer", "Electrical Engineering", "HR",
        "Hadoop", "Health and fitness", "Java Developer",
        "Mechanical Engineer", "Network Security Engineer",
        "Operations Manager", "PMO", "Python Developer",
        "SAP Developer", "Sales", "Testing", "Web Designing",
    ];
    return _categories;
}

const categoryKeywords: Record<string, string[]> = {
    "Data Science": ["data science", "machine learning", "deep learning", "tensorflow", "pytorch", "pandas", "numpy", "data analysis", "data visualization", "nlp", "neural network", "scikit-learn", "data scientist"],
    "Java Developer": ["java", "spring boot", "hibernate", "j2ee", "jvm", "maven", "spring framework", "java developer"],
    "Python Developer": ["python", "django", "flask", "fastapi", "pandas", "numpy", "python developer"],
    "Web Designing": ["html", "css", "javascript", "web design", "ui/ux", "figma", "photoshop", "responsive", "bootstrap", "frontend", "front-end", "web developer", "web development", "full stack", "fullstack"],
    "DevOps Engineer": ["devops", "docker", "kubernetes", "ci/cd", "jenkins", "terraform", "ansible", "aws", "azure", "infrastructure", "deployment", "devops engineer"],
    "Database": ["sql", "mysql", "postgresql", "oracle", "mongodb", "database", "dba", "data modeling", "database administrator"],
    "Hadoop": ["hadoop", "spark", "hive", "pig", "mapreduce", "hdfs", "cloudera", "big data", "kafka", "data engineer"],
    "Blockchain": ["blockchain", "ethereum", "solidity", "smart contract", "web3", "cryptocurrency", "decentralized"],
    "Testing": ["testing", "qa", "quality assurance", "selenium", "test automation", "manual testing", "test cases", "software testing", "quality analyst"],
    "Automation Testing": ["automation testing", "selenium", "appium", "cypress", "test automation", "automated testing", "automation engineer"],
    "DotNet Developer": [".net", "c#", "asp.net", "dotnet", "entity framework", "wpf", "visual studio", ".net developer"],
    "ETL Developer": ["etl", "informatica", "talend", "ssis", "data warehouse", "data pipeline", "data integration", "etl developer"],
    "Network Security Engineer": ["network security", "firewall", "vpn", "cybersecurity", "penetration testing", "ethical hacking", "ids", "ips", "security engineer"],
    "SAP Developer": ["sap", "abap", "hana", "sap basis", "sap fi", "sap developer"],
    "Mechanical Engineer": ["mechanical engineer", "cad", "autocad", "solidworks", "manufacturing", "cnc", "thermodynamics", "mechanical design"],
    "Civil Engineer": ["civil engineer", "structural", "construction", "autocad", "building design", "surveying", "concrete"],
    "Electrical Engineering": ["electrical engineer", "circuit", "power systems", "plc", "embedded", "electronics", "vlsi", "electrical engineering"],
    "HR": ["human resources", "recruitment", "talent acquisition", "onboarding", "payroll", "employee relations", "hr manager", "hr executive"],
    "Sales": ["sales", "business development", "revenue", "crm", "salesforce", "lead generation", "b2b", "b2c", "sales manager"],
    "Business Analyst": ["business analyst", "business analysis", "requirements gathering", "stakeholder", "use case", "brd", "agile methodology"],
    "PMO": ["project management office", "pmo", "pmp", "prince2", "risk management", "project manager", "project plan", "project management"],
    "Operations Manager": ["operations manager", "supply chain", "logistics", "process improvement", "lean", "six sigma", "inventory management"],
    "Arts": ["graphic design", "illustration", "adobe creative", "animation", "photography", "ui design", "graphic designer"],
    "Advocate": ["law", "legal", "advocate", "litigation", "compliance", "attorney", "legal advisor"],
    "Health and fitness": ["health", "fitness", "nutrition", "healthcare", "clinical", "patient care", "nursing", "medical"],
};

function classifyResumeCategory(text: string): { category: string; confidence: number } {
    const categories = loadCategories();
    const normalized = normalizeText(text);

    let bestCategory = "Web Designing"; // reasonable default
    let bestScore = 0;

    for (const cat of categories) {
        const keywords = categoryKeywords[cat] || [cat.toLowerCase()];
        let score = 0;
        for (const kw of keywords) {
            // Count occurrences
            let idx = 0;
            let count = 0;
            while (true) {
                idx = normalized.indexOf(kw, idx);
                if (idx === -1) break;
                count++;
                idx += kw.length;
            }
            score += count;
        }
        if (score > bestScore) {
            bestScore = score;
            bestCategory = cat;
        }
    }

    const confidence = Math.min(bestScore / 15, 1.0);
    return { category: bestCategory, confidence: Math.round(confidence * 100) / 100 };
}

// ═══════════════════════════════════════════════════════════════════
//  5. ATS SCORE CALCULATION
// ═══════════════════════════════════════════════════════════════════

interface ATSScoreResult {
    atsScore: number;
    breakdown: {
        skillMatch: number;
        categoryRelevance: number;
        keywordDensity: number;
        formatQuality: number;
        experienceMatch: number;
    };
}

function calculateATSScore(
    resumeSkills: string[],
    jdSkills: string[],
    matchedSkills: string[],
    resumeText: string,
    _jdText: string,
    semanticSimilarity: number,
    categoryConfidence: number,
): ATSScoreResult {
    // 1. Skill Match (40%)
    const skillMatchRatio = jdSkills.length > 0
        ? matchedSkills.length / jdSkills.length
        : (resumeSkills.length > 5 ? 0.6 : 0.3);
    const skillMatchScore = Math.round(skillMatchRatio * 100);

    // 2. Category Relevance (20%)
    const categoryScore = Math.round((categoryConfidence * 50 + semanticSimilarity * 50));

    // 3. Keyword Density (15%)
    const resumeWords = resumeText.split(/\s+/).length;
    const skillCount = resumeSkills.length;
    const densityRatio = skillCount / Math.max(resumeWords / 50, 1);
    const keywordScore = Math.min(Math.round(densityRatio * 25), 100);

    // 4. Format Quality (10%)
    let formatScore = 40;
    if (resumeText.length > 200) formatScore += 10;
    if (resumeText.length > 500) formatScore += 10;
    if (/education|experience|skills|projects?|certifications?|summary|objective/i.test(resumeText)) formatScore += 15;
    if (/\b(20\d{2})\b/.test(resumeText)) formatScore += 10; // years
    if (resumeText.includes("@")) formatScore += 5; // email
    if (/\d{10}|\+\d/.test(resumeText)) formatScore += 5; // phone
    formatScore = Math.min(formatScore, 100);

    // 5. Experience Match (15%)
    const experienceScore = Math.round(semanticSimilarity * 100);

    // Weighted total
    const atsScore = Math.round(
        skillMatchScore * 0.40 +
        categoryScore * 0.20 +
        keywordScore * 0.15 +
        formatScore * 0.10 +
        experienceScore * 0.15
    );

    return {
        atsScore: Math.min(Math.max(atsScore, 0), 100),
        breakdown: {
            skillMatch: skillMatchScore,
            categoryRelevance: categoryScore,
            keywordDensity: keywordScore,
            formatQuality: formatScore,
            experienceMatch: experienceScore,
        },
    };
}

// ═══════════════════════════════════════════════════════════════════
//  6. ML-BASED RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════════

function generateMLRecommendations(
    missingSkills: string[],
    category: string,
    atsScore: number,
    breakdown: ATSScoreResult["breakdown"],
    matchedSkills: string[],
    additionalSkills: string[],
): string[] {
    const recs: string[] = [];

    // Missing skills
    if (missingSkills.length > 0) {
        const top = missingSkills.slice(0, 8);
        recs.push(`Add these skills from the JD to your resume: **${top.join(", ")}**`);
    }

    if (missingSkills.length > 8) {
        recs.push(`You're missing ${missingSkills.length} skills from the JD. Prioritize the top 5-8 most relevant ones and integrate them naturally.`);
    }

    // Score-specific advice
    if (breakdown.skillMatch < 40) {
        recs.push("Your skill match is below 40%. Carefully review the job description and mirror its exact terminology in your Skills section.");
    } else if (breakdown.skillMatch < 70) {
        recs.push("Your skill match could improve. Add more JD-relevant keywords in your experience bullet points, not just the Skills section.");
    }

    if (breakdown.keywordDensity < 30) {
        recs.push("Your resume has low keyword density. Weave technical terms into your project descriptions and achievements, not just a skills list.");
    }

    if (breakdown.formatQuality < 60) {
        recs.push("Improve resume structure: add clear sections for Education, Experience, Skills, Projects, and Certifications with consistent formatting.");
    }

    if (breakdown.experienceMatch < 50) {
        recs.push("Your experience doesn't closely align with the JD. Rewrite bullet points to emphasize transferable skills and relevant projects.");
    }

    // Category advice
    if (category) {
        recs.push(`Your resume is classified as '${category}'. Make sure your resume summary and headline align with the target job role.`);
    }

    // Matched skills reinforcement
    if (matchedSkills.length > 0 && matchedSkills.length < 5) {
        recs.push(`You match ${matchedSkills.length} skills (${matchedSkills.join(", ")}). Strengthen these by providing specific examples and quantifiable results.`);
    }

    // Additional skills value
    if (additionalSkills.length > 5) {
        recs.push(`You have ${additionalSkills.length} extra skills not in the JD. Consider removing less relevant ones to keep your resume focused and ATS-optimized.`);
    }

    // Score-level advice
    if (atsScore < 40) {
        recs.push("Your ATS score is low. Consider tailoring your entire resume specifically for this role — use the JD as a template for your skills and experience wording.");
    } else if (atsScore >= 70 && atsScore < 85) {
        recs.push("Good match! Add quantifiable achievements (e.g., 'Improved API response time by 40%') to stand out further.");
    } else if (atsScore >= 85) {
        recs.push("Excellent match! Your resume is well-aligned. Focus on proofreading and adding 1-2 impressive metrics to make it perfect.");
    }

    return recs;
}

// ═══════════════════════════════════════════════════════════════════
//  7. GEMINI AI RECOMMENDATIONS (multi-key fallback)
// ═══════════════════════════════════════════════════════════════════

async function generateGeminiRecommendations(
    resumeText: string,
    jdText: string,
    atsScore: number,
    matchedSkills: string[],
    missingSkills: string[],
    category: string,
): Promise<string[]> {
    const hasJD = jdText.trim().length > 20;

    const prompt = hasJD
        ? `You are an expert ATS resume consultant. Analyze this resume against the job description.

RESUME (first 3000 chars):
${resumeText.slice(0, 3000)}

JOB DESCRIPTION (first 2000 chars):
${jdText.slice(0, 2000)}

ANALYSIS:
- ATS Score: ${atsScore}/100
- Category: ${category}
- Matched Skills: ${matchedSkills.slice(0, 15).join(", ") || "none"}
- Missing Skills: ${missingSkills.slice(0, 10).join(", ") || "none"}

Provide exactly 5-7 specific, actionable recommendations to improve this resume's ATS compatibility.
Return ONLY a JSON array of strings. No markdown, no explanation.
Example: ["Add Python to skills section", "Quantify your project impact"]`
        : `You are an expert ATS resume consultant. Analyze this resume and provide improvements.

RESUME (first 3000 chars):
${resumeText.slice(0, 3000)}

ANALYSIS:
- Resume Quality Score: ${atsScore}/100
- Detected Category: ${category}
- Skills Found: ${matchedSkills.slice(0, 15).join(", ") || "none"}

Provide exactly 5-7 specific, actionable recommendations to improve this resume for ATS systems and recruiters.
Focus on: formatting, keyword optimization, quantifiable achievements, section structure, and industry best practices for "${category}" roles.
Return ONLY a JSON array of strings. No markdown, no explanation.
Example: ["Add measurable achievements to each role", "Improve skills section formatting"]`;

    const keys = getAllGeminiKeys();
    const models = ["gemini-2.0-flash", "gemini-1.5-flash"];

    for (const key of keys) {
        for (const modelName of models) {
            try {
                console.log(`[ATS] Trying Gemini recs: model=${modelName}, key=...${key.slice(-6)}`);
                const genAI = new GoogleGenerativeAI(key);
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent(prompt);
                const text = result.response.text().trim();

                const jsonMatch = text.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    if (Array.isArray(parsed)) {
                        console.log(`[ATS] Gemini recs OK (model=${modelName})`);
                        return parsed.filter((r: any) => typeof r === "string").slice(0, 7);
                    }
                }
                return text.split("\n").map(l => l.replace(/^[\d\-*.)]+\s*/, "").trim()).filter(l => l.length > 10).slice(0, 7);
            } catch (err: any) {
                console.warn(`[ATS] Gemini failed (${modelName}, ...${key.slice(-6)}): ${err?.message?.slice(0, 100)}`);
                continue;
            }
        }
    }

    console.warn("[ATS] All Gemini keys exhausted, trying Groq/OpenRouter fallback...");

    // Fallback: try Groq keys
    type GroqResp = { choices: Array<{ message: { content: string } }> };
    for (const key of getAllGroqKeys()) {
        try {
            console.log(`[ATS] Trying Groq recs: key=...${key.slice(-6)}`);
            const data = await fetchJson<GroqResp>("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    temperature: 0.3,
                    messages: [
                        { role: "system", content: "Return ONLY a JSON array of strings." },
                        { role: "user", content: prompt },
                    ],
                }),
            });
            const text = data.choices?.[0]?.message?.content?.trim() ?? "";
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (Array.isArray(parsed)) {
                    console.log(`[ATS] Groq recs OK`);
                    return parsed.filter((r: any) => typeof r === "string").slice(0, 7);
                }
            }
            return text.split("\n").map(l => l.replace(/^[\d\-*.)]+\s*/, "").trim()).filter(l => l.length > 10).slice(0, 7);
        } catch (err: any) {
            console.warn(`[ATS] Groq recs failed (key=...${key.slice(-6)}): ${err?.message?.slice(0, 100)}`);
        }
    }

    // Fallback: try OpenRouter
    const orKey = getOpenRouterKey();
    if (orKey) {
        try {
            console.log(`[ATS] Trying OpenRouter recs`);
            const data = await fetchJson<GroqResp>("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: { "content-type": "application/json", authorization: `Bearer ${orKey}` },
                body: JSON.stringify({
                    model: "meta-llama/llama-3.3-70b-instruct:free",
                    temperature: 0.3,
                    messages: [
                        { role: "system", content: "Return ONLY a JSON array of strings." },
                        { role: "user", content: prompt },
                    ],
                }),
            });
            const text = data.choices?.[0]?.message?.content?.trim() ?? "";
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (Array.isArray(parsed)) {
                    console.log(`[ATS] OpenRouter recs OK`);
                    return parsed.filter((r: any) => typeof r === "string").slice(0, 7);
                }
            }
            return text.split("\n").map(l => l.replace(/^[\d\-*.)]+\s*/, "").trim()).filter(l => l.length > 10).slice(0, 7);
        } catch (err: any) {
            console.warn(`[ATS] OpenRouter recs failed: ${err?.message?.slice(0, 100)}`);
        }
    }

    console.warn("[ATS] All providers exhausted for recommendations");
    return ["AI recommendations are temporarily unavailable due to API rate limits. The ML-based recommendations above are still fully functional."];
}

// ═══════════════════════════════════════════════════════════════════
//  8. MERGE RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════════

function mergeRecommendations(mlRecs: string[], geminiRecs: string[]): string[] {
    const seen = new Set<string>();
    const final: string[] = [];
    const all = [...geminiRecs, ...mlRecs];

    for (const rec of all) {
        const key = rec.toLowerCase().slice(0, 40);
        let isDup = false;
        for (const s of seen) {
            if (s.includes(key.slice(0, 25)) || key.includes(s.slice(0, 25))) { isDup = true; break; }
        }
        if (!isDup && rec.length > 10) {
            seen.add(key);
            final.push(rec);
        }
    }
    return final.slice(0, 12);
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN ANALYSIS PIPELINE
// ═══════════════════════════════════════════════════════════════════

export interface AnalysisResult {
    resumeText: string;
    jdText: string;
    extractedSkills: string[];
    jdSkills: string[];
    matchedSkills: string[];
    missingSkills: string[];
    additionalSkills: string[];
    atsScore: number;
    categoryPrediction: string;
    categoryConfidence: number;
    scoreBreakdown: ATSScoreResult["breakdown"];
    mlRecommendations: string[];
    geminiRecommendations: string[];
    finalRecommendations: string[];
    pipeline: Array<{ step: string; status: string; detail: string }>;
}

export async function analyzeResume(
    resumeBuffer: Buffer,
    jdBuffer: Buffer | null,
    resumeFileName: string,
    jdFileName: string,
): Promise<AnalysisResult> {
    const pipeline: Array<{ step: string; status: string; detail: string }> = [];
    const hasJD = jdBuffer !== null && jdBuffer.length > 0;

    // ── Step 1: Parse PDFs ──
    console.log("[ATS] Step 1: Parsing PDFs...");
    let resumeText = "";
    let jdText = "";

    try {
        resumeText = await extractTextFromPdf(resumeBuffer);
        pipeline.push({ step: "Resume Parsing", status: "done", detail: `Extracted ${resumeText.length} chars` });
    } catch (err: any) {
        console.error("[ATS] Resume PDF parse error:", err?.message || err);
        resumeText = resumeBuffer.toString("utf-8");
        pipeline.push({ step: "Resume Parsing", status: "done", detail: "Parsed as plain text (PDF parse failed)" });
    }

    if (hasJD) {
        try {
            jdText = await extractTextFromPdf(jdBuffer!);
            pipeline.push({ step: "JD Parsing", status: "done", detail: `Extracted ${jdText.length} chars` });
        } catch (err: any) {
            console.error("[ATS] JD PDF parse error:", err?.message || err);
            jdText = jdBuffer!.toString("utf-8");
            pipeline.push({ step: "JD Parsing", status: "done", detail: "Parsed as plain text (PDF parse failed)" });
        }
    } else {
        pipeline.push({ step: "JD Parsing", status: "done", detail: "Skipped (no JD provided — resume-only analysis)" });
    }

    // Log first 500 chars for debug
    console.log("[ATS] Resume text (first 500):", resumeText.slice(0, 500).replace(/\n/g, " "));
    if (hasJD) console.log("[ATS] JD text (first 500):", jdText.slice(0, 500).replace(/\n/g, " "));

    if (!resumeText || resumeText.trim().length < 20) {
        throw new Error("Could not extract meaningful text from resume PDF.");
    }

    // ── Step 2: Category Classification ──
    console.log("[ATS] Step 2: Classifying...");
    const { category, confidence } = classifyResumeCategory(resumeText);
    pipeline.push({ step: "Resume Classification", status: "done", detail: `${category} (${Math.round(confidence * 100)}%)` });

    // ── Step 3: Skill Extraction ──
    console.log("[ATS] Step 3: Extracting skills...");
    const resumeSkillsResult = extractSkills(resumeText);
    const allResumeSkills = [...resumeSkillsResult.techSkills, ...resumeSkillsResult.softSkills];

    let allJdSkills: string[] = [];
    if (hasJD) {
        const jdSkillsResult = extractSkills(jdText);
        allJdSkills = [...jdSkillsResult.techSkills, ...jdSkillsResult.softSkills];
    }

    console.log(`[ATS] Resume skills (${allResumeSkills.length}):`, allResumeSkills.join(", "));
    if (hasJD) console.log(`[ATS] JD skills (${allJdSkills.length}):`, allJdSkills.join(", "));

    pipeline.push({ step: "Skill Extraction", status: "done", detail: hasJD ? `Resume: ${allResumeSkills.length} | JD: ${allJdSkills.length} skills` : `Found ${allResumeSkills.length} skills in resume` });

    // ── Step 4: Skill Matching ──
    console.log("[ATS] Step 4: Matching...");
    const resumeSkillSet = new Set(allResumeSkills.map(s => s.toLowerCase()));
    const jdSkillSet = new Set(allJdSkills.map(s => s.toLowerCase()));

    const matchedSkills = allJdSkills.filter(s => resumeSkillSet.has(s.toLowerCase()));
    const missingSkills = allJdSkills.filter(s => !resumeSkillSet.has(s.toLowerCase()));
    const additionalSkills = allResumeSkills.filter(s => !jdSkillSet.has(s.toLowerCase()));
    pipeline.push({ step: "Skill Matching", status: "done", detail: hasJD ? `${matchedSkills.length} matched, ${missingSkills.length} missing` : `${allResumeSkills.length} skills identified (no JD to compare)` });

    // ── Step 5: Semantic Similarity ──
    console.log("[ATS] Step 5: Semantic similarity...");
    let semanticSimilarity = 0.5;
    if (hasJD) {
        try {
            const [rEmb, jEmb] = await Promise.all([
                generateEmbedding(resumeText.slice(0, 5000)),
                generateEmbedding(jdText.slice(0, 5000)),
            ]);
            semanticSimilarity = cosineSimilarity(rEmb, jEmb);
            pipeline.push({ step: "Semantic Analysis", status: "done", detail: `Similarity: ${(semanticSimilarity * 100).toFixed(1)}%` });
        } catch (err) {
            console.warn("[ATS] Embedding failed:", (err as any)?.message?.slice(0, 100));
            pipeline.push({ step: "Semantic Analysis", status: "done", detail: "Fallback (keyword-based)" });
        }
    } else {
        // No JD — use embedding to assess resume quality vs category
        semanticSimilarity = confidence > 0.5 ? 0.7 : 0.5;
        pipeline.push({ step: "Semantic Analysis", status: "done", detail: "Resume quality assessment (no JD)" });
    }

    // ── Step 6: ATS Score ──
    console.log("[ATS] Step 6: Scoring...");
    const { atsScore, breakdown } = calculateATSScore(
        allResumeSkills, allJdSkills, matchedSkills,
        resumeText, jdText, semanticSimilarity, confidence,
    );
    pipeline.push({ step: "ATS Score", status: "done", detail: `${atsScore}/100` });

    // ── Step 7: ML Recommendations ──
    console.log("[ATS] Step 7: ML recommendations...");
    const mlRecs = generateMLRecommendations(missingSkills, category, atsScore, breakdown, matchedSkills, additionalSkills);
    pipeline.push({ step: "ML Recommendations", status: "done", detail: `${mlRecs.length} suggestions` });

    // ── Step 8: Gemini Recommendations ──
    console.log("[ATS] Step 8: Gemini recommendations...");
    const geminiRecs = await generateGeminiRecommendations(
        resumeText, jdText, atsScore, matchedSkills, missingSkills, category,
    );
    pipeline.push({ step: "AI Recommendations", status: "done", detail: `${geminiRecs.length} suggestions` });

    // ── Step 9: Merge ──
    const finalRecs = mergeRecommendations(mlRecs, geminiRecs);
    pipeline.push({ step: "Final Analysis", status: "done", detail: `${finalRecs.length} combined recommendations` });

    return {
        resumeText,
        jdText,
        extractedSkills: allResumeSkills,
        jdSkills: allJdSkills,
        matchedSkills: [...new Set(matchedSkills)],
        missingSkills: [...new Set(missingSkills)],
        additionalSkills: [...new Set(additionalSkills)],
        atsScore,
        categoryPrediction: category,
        categoryConfidence: confidence,
        scoreBreakdown: breakdown,
        mlRecommendations: mlRecs,
        geminiRecommendations: geminiRecs,
        finalRecommendations: finalRecs,
        pipeline,
    };
}
