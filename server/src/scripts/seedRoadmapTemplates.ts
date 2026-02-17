import "dotenv/config";

import mongoose from "mongoose";

import type { RoadmapCategory, RoadmapPlanDay, RoadmapPlanWeek } from "../models/RoadmapPlan";
import { RoadmapTemplate } from "../models/RoadmapTemplate";
import { getCareerPathsFromDataset } from "../services/skillsDataset";
import { getOrCreateRoadmapTemplateWeeks } from "../services/roadmapTemplates";

function forceMongoDbName(uri: string, dbName: string): string {
  const input = String(uri ?? "").trim();
  if (!input) return input;

  const schemeSep = input.indexOf("://");
  if (schemeSep < 0) return input;

  const afterScheme = schemeSep + 3;
  const firstSlashAfterHost = input.indexOf("/", afterScheme);
  const queryStart = input.indexOf("?", afterScheme);

  if (firstSlashAfterHost < 0 || (queryStart >= 0 && firstSlashAfterHost > queryStart)) {
    if (queryStart >= 0) return `${input.slice(0, queryStart)}/${dbName}${input.slice(queryStart)}`;
    return `${input}/${dbName}`;
  }

  const pathStart = firstSlashAfterHost;
  const pathEnd = queryStart >= 0 ? queryStart : input.length;
  const currentPath = input.slice(pathStart + 1, pathEnd);

  if (!currentPath) return `${input.slice(0, pathStart + 1)}${dbName}${input.slice(pathEnd)}`;
  if (currentPath !== dbName) return `${input.slice(0, pathStart + 1)}${dbName}${input.slice(pathEnd)}`;
  return input;
}

function gfgResource(topic: string) {
  const q = encodeURIComponent(topic);
  return [{ title: "GeeksforGeeks", url: `https://www.geeksforgeeks.org/search/${q}` }];
}

function weekDifficulty(week: number): RoadmapPlanDay["difficulty"] {
  if (week <= 4) return "Beginner";
  if (week <= 8) return "Intermediate";
  return "Advanced";
}

function guessCategory(topic: string): RoadmapCategory {
  const t = String(topic ?? "").trim().toLowerCase();
  if (t.startsWith("dsa")) return "dsa";
  if (t.startsWith("aptitude")) return "aptitude";
  if (t.startsWith("soft skills") || t.startsWith("softskills")) return "softskills";
  return "tech";
}

function toWeek(week: number, days: string[]): RoadmapPlanWeek {
  const diff = weekDifficulty(week);
  return {
    week,
    title: `Week ${week}`,
    days: days.slice(0, 7).map((topicRaw, idx) => {
      const topic = String(topicRaw ?? "").trim();
      return {
        day: idx + 1,
        topic,
        category: guessCategory(topic),
        difficulty: diff,
        resources: gfgResource(topic),
      };
    }),
  };
}

const roleRoadmaps: Array<{ role: string; weeks: string[][] }> = [
  {
    role: "Prompt Engineer",
    weeks: [
      ["LLM Basics","Transformers Intro","Tokenization","Prompt Structure","Zero vs Few Shot","DSA: Arrays","Soft Skills: Communication"],
      ["Prompt Patterns","Chain of Thought","Role Prompting","Context Windows","Temperature & Top-p","DSA: Strings","Aptitude: Percentages"],
      ["Prompt Evaluation","Prompt Testing","Hallucination Handling","Prompt Debugging","Safety & Ethics","DSA: Recursion","Soft Skills: Writing"],
      ["OpenAI/Gemini APIs","RAG Basics","Embeddings","Vector DB Intro","LangChain Basics","DSA: Linked List","Aptitude: Time & Work"],
      ["Advanced RAG","Agents Intro","Tool Calling","Memory in LLMs","Fine-tuning Basics","DSA: Stack","Soft Skills: Presentation"],
      ["LLM Security","Prompt Injection","Red Teaming","Evaluation Metrics","Cost Optimization","DSA: Queue","Aptitude: Probability"],
      ["Multimodal LLMs","Vision Models","Speech Models","Prompt for Code","Prompt for Data","DSA: Trees","Soft Skills: Interview Prep"],
      ["AI Product Design","Use Case Design","A/B Testing","Analytics","User Feedback","DSA: Binary Search","Aptitude: DI"],
      ["LLM Deployment","API Scaling","Caching","Monitoring","Logging","DSA: Sorting","Soft Skills: HR Round"],
      ["Advanced Agents","Autonomous Workflows","AI Automation","Workflow Tools","Zapier/Integrations","DSA: DP Basics","Aptitude: Reasoning"],
      ["Capstone Project Planning","Build AI App","Testing","Optimization","Deployment","DSA: Graphs","Soft Skills: Mock Interview"],
      ["Revision","Advanced Prompt Practice","Edge Cases","Performance Tuning","Portfolio Building","DSA Mixed","Final Interview Simulation"],
    ],
  },
  {
    role: "AI / ML Engineer",
    weeks: [
      ["Python Basics","NumPy","Pandas","Matplotlib","Statistics Basics","DSA: Arrays","Soft Skills"],
      ["Linear Algebra","Probability","Data Cleaning","EDA","Feature Engineering","DSA: Strings","Aptitude"],
      ["Regression","Classification","Model Evaluation","Bias-Variance","Cross Validation","DSA: Recursion","Communication"],
      ["Decision Trees","Random Forest","SVM","KNN","Model Tuning","DSA: Linked List","Aptitude"],
      ["Neural Networks","Backpropagation","TensorFlow/PyTorch","Activation Functions","Loss Functions","DSA: Stack","Presentation"],
      ["CNN","RNN","Transformers","Transfer Learning","Model Optimization","DSA: Queue","Probability"],
      ["NLP Basics","Embeddings","LLMs Intro","Fine-tuning","RAG","DSA: Trees","Interview Prep"],
      ["MLOps Intro","Docker","CI/CD","Model Deployment","API Serving","DSA: Binary Search","DI"],
      ["Cloud ML (AWS/GCP)","Pipelines","Data Versioning","MLflow","Monitoring","DSA: Sorting","HR Prep"],
      ["Scalability","Distributed Training","GPU Optimization","Model Security","Ethics","DSA: DP","Reasoning"],
      ["Capstone ML Project","Testing","Optimization","Deployment","Documentation","DSA: Graphs","Mock Interview"],
      ["Revision","Hard ML Problems","Research Papers","System Design","Portfolio","Mixed DSA","Final Simulation"],
    ],
  },
  {
    role: "Data Scientist",
    weeks: [
      ["Python","Pandas","Data Cleaning","EDA","Visualization","DSA Arrays","Soft Skills"],
      ["Statistics","Hypothesis Testing","Probability","Sampling","Confidence Intervals","DSA Strings","Aptitude"],
      ["Regression","Classification","Clustering","Evaluation Metrics","Feature Selection","DSA Recursion","Communication"],
      ["SQL Basics","Advanced SQL","Joins","Indexes","Optimization","DSA Linked List","Aptitude"],
      ["Time Series","ARIMA","Forecasting","Anomaly Detection","Model Tuning","DSA Stack","Presentation"],
      ["NLP","Text Processing","Sentiment Analysis","Embeddings","LLMs","DSA Queue","Probability"],
      ["Big Data Intro","Spark","Hadoop","Data Pipelines","ETL","DSA Trees","Interview"],
      ["Tableau/Power BI","Dashboarding","Storytelling","KPI Design","Business Metrics","DSA Binary Search","DI"],
      ["Cloud Data Tools","Data Warehousing","Snowflake","Redshift","Monitoring","DSA Sorting","HR"],
      ["Experimentation","A/B Testing","Causal Inference","Optimization","Business Case","DSA DP","Reasoning"],
      ["Capstone Analytics Project","Deployment","Reporting","Optimization","Presentation","DSA Graphs","Mock"],
      ["Revision","Case Studies","Advanced SQL","Advanced ML","Portfolio","Mixed DSA","Final Simulation"],
    ],
  },
  {
    role: "Full Stack Developer",
    weeks: [
      ["HTML","CSS","Flexbox","JavaScript Basics","ES6","DSA Arrays","Soft Skills"],
      ["Advanced JS","DOM","Async JS","Git","GitHub","DSA Strings","Aptitude"],
      ["React Basics","Hooks","Routing","Forms","API Integration","DSA Recursion","Communication"],
      ["Advanced React","Redux","Project Structure","Testing","Mini Project","DSA Linked List","Aptitude"],
      ["Node.js","Express","REST APIs","Middleware","JWT","DSA Stack","Presentation"],
      ["MongoDB","Mongoose","CRUD","Indexes","Backend Project","DSA Queue","Probability"],
      ["System Design","MVC","Authentication Flow","File Upload","Deployment","DSA Trees","Interview"],
      ["TypeScript","Next.js","SSR","Docker","CI/CD","DSA Binary Search","DI"],
      ["Caching","Redis","WebSockets","Security","Optimization","DSA Sorting","HR"],
      ["GraphQL","Microservices","Scalability","Performance","Project Planning","DSA DP","Reasoning"],
      ["Major Project FE","Major Project BE","Integration","Testing","Deployment","DSA Graphs","Mock"],
      ["Revision FE","Revision BE","System Design","Mixed JS","Portfolio","Mixed DSA","Final Interview"],
    ],
  },
  {
    role: "Backend Developer",
    weeks: [
      ["Programming Language (Node/Java/Python)","OOP Concepts","REST Basics","HTTP Protocol","Git","DSA Arrays","Soft Skills"],
      ["Advanced Language Concepts","Async Processing","Error Handling","Logging","Testing Basics","DSA Strings","Aptitude"],
      ["Express/Spring Boot","Middleware","CRUD APIs","Validation","Postman","DSA Recursion","Communication"],
      ["Authentication (JWT/OAuth)","Authorization","RBAC","Security Basics","Password Hashing","DSA Linked List","Aptitude"],
      ["SQL Basics","Advanced SQL","Indexes","Transactions","Optimization","DSA Stack","Presentation"],
      ["MongoDB/NoSQL","Schema Design","Aggregation","Caching","Redis","DSA Queue","Probability"],
      ["System Design Basics","MVC","Layered Architecture","API Design","Swagger","DSA Trees","Interview"],
      ["Docker","CI/CD","Cloud Deployment","Nginx","Load Balancing","DSA Binary Search","DI"],
      ["Microservices","Message Queues","Kafka Basics","Event Driven","Scalability","DSA Sorting","HR"],
      ["Performance Tuning","Profiling","Memory Mgmt","Security Advanced","Monitoring","DSA DP","Reasoning"],
      ["Capstone Backend Project","Testing","Optimization","Deployment","Documentation","DSA Graphs","Mock"],
      ["Revision","Advanced Problems","System Design Deep Dive","API Optimization","Portfolio","Mixed DSA","Final Interview"],
    ],
  },
  {
    role: "Frontend Developer",
    weeks: [
      ["HTML","CSS","Responsive Design","Flexbox/Grid","Git","DSA Arrays","Soft Skills"],
      ["JavaScript Basics","ES6","DOM","Events","Debugging","DSA Strings","Aptitude"],
      ["Async JS","APIs","Error Handling","Browser DevTools","Performance","DSA Recursion","Communication"],
      ["React/Vue Basics","Components","Props/State","Hooks","Routing","DSA Linked List","Aptitude"],
      ["Forms & Validation","State Mgmt","Redux/Context","Testing","Mini Project","DSA Stack","Presentation"],
      ["Advanced React","Code Splitting","Optimization","SEO Basics","Accessibility","DSA Queue","Probability"],
      ["TypeScript","Next.js","SSR/SSG","API Integration","Auth","DSA Trees","Interview"],
      ["UI/UX Principles","Design Systems","Tailwind/Bootstrap","Animations","Charts","DSA Binary Search","DI"],
      ["Web Security","XSS/CSRF","Performance Audit","Lighthouse","PWA","DSA Sorting","HR"],
      ["Testing Advanced","Jest","Cypress","CI/CD","Deployment","DSA DP","Reasoning"],
      ["Capstone FE Project","Optimization","Testing","Deployment","Docs","DSA Graphs","Mock"],
      ["Revision","Advanced UI","System Design FE","Portfolio","Mixed Practice","Mixed DSA","Final Interview"],
    ],
  },
  {
    role: "DevOps Engineer",
    weeks: [
      ["Linux Basics","Shell Scripting","Networking Basics","Git","DSA Arrays","Soft Skills"],
      ["CI/CD Concepts","Jenkins/GitHub Actions","Docker Basics","Images/Containers","DSA Strings","Aptitude"],
      ["Docker Advanced","Docker Compose","Kubernetes Basics","Pods/Services","DSA Recursion","Communication"],
      ["Kubernetes Advanced","Helm","Ingress","Scaling","DSA Linked List","Aptitude"],
      ["Cloud Basics (AWS/Azure)","EC2","S3","IAM","DSA Stack","Presentation"],
      ["Infrastructure as Code","Terraform","Monitoring","Prometheus","DSA Queue","Probability"],
      ["Logging","ELK Stack","Security","DevSecOps","DSA Trees","Interview"],
      ["Load Balancing","Auto Scaling","High Availability","Backup","DSA Binary Search","DI"],
      ["Microservices Infra","Service Mesh","API Gateway","Caching","DSA Sorting","HR"],
      ["Performance Tuning","Cost Optimization","Incident Mgmt","SRE Basics","DSA DP","Reasoning"],
      ["Capstone Infra Project","Automation","Testing","Deployment","Docs","DSA Graphs","Mock"],
      ["Revision","Advanced Kubernetes","Cloud Architecture","Portfolio","Mixed Practice","Mixed DSA","Final Interview"],
    ],
  },
  {
    role: "Cloud Engineer",
    weeks: [
      ["Cloud Fundamentals","Virtualization","Networking","Linux","DSA Arrays","Soft Skills"],
      ["AWS/Azure Basics","Compute","Storage","IAM","DSA Strings","Aptitude"],
      ["VPC","Subnets","Security Groups","Load Balancer","DSA Recursion","Communication"],
      ["Databases in Cloud","RDS","NoSQL","Backup","DSA Linked List","Aptitude"],
      ["Serverless","Lambda","API Gateway","Event Driven","DSA Stack","Presentation"],
      ["Docker","Kubernetes","CI/CD","Deployment","DSA Queue","Probability"],
      ["Monitoring","CloudWatch","Logging","Alerts","DSA Trees","Interview"],
      ["Terraform","IaC","Automation","Scaling","DSA Binary Search","DI"],
      ["Security Advanced","Encryption","Compliance","Cost Mgmt","DSA Sorting","HR"],
      ["High Availability","Disaster Recovery","Multi Region","Optimization","DSA DP","Reasoning"],
      ["Capstone Cloud Project","Deployment","Testing","Optimization","Docs","DSA Graphs","Mock"],
      ["Revision","Architecture Design","Advanced Security","Portfolio","Mixed Practice","Mixed DSA","Final Interview"],
    ],
  },
  {
    role: "Mobile App Developer",
    weeks: [
      ["Programming Basics (Kotlin/Swift/Dart)","OOP","Mobile Architecture","Git","UI Basics","DSA Arrays","Soft Skills"],
      ["Android/iOS Setup","Layouts","Navigation","State Mgmt","Debugging","DSA Strings","Aptitude"],
      ["API Integration","Async Calls","Error Handling","Local Storage","Testing Basics","DSA Recursion","Communication"],
      ["Advanced UI","Animations","Responsive Design","Accessibility","Performance","DSA Linked List","Aptitude"],
      ["Authentication","Push Notifications","Firebase","Security","App Lifecycle","DSA Stack","Presentation"],
      ["Database (SQLite/Realm)","Caching","Offline Support","Optimization","DSA Queue","Probability"],
      ["State Management Advanced","Architecture (MVVM)","Clean Code","Refactoring","DSA Trees","Interview"],
      ["CI/CD Mobile","App Store Deployment","Versioning","Crash Analytics","DSA Binary Search","DI"],
      ["Advanced Performance","Memory Mgmt","Battery Optimization","Security Advanced","DSA Sorting","HR"],
      ["System Design Mobile","Scalability","Modularization","Testing Advanced","DSA DP","Reasoning"],
      ["Capstone App Project","Testing","Optimization","Deployment","Docs","DSA Graphs","Mock"],
      ["Revision","Advanced Concepts","Portfolio","Case Studies","Interview Q&A","Mixed DSA","Final Interview"],
    ],
  },
  {
    role: "Cybersecurity Engineer",
    weeks: [
      ["Networking Basics","Linux","Security Fundamentals","Cryptography Basics","DSA Arrays","Soft Skills"],
      ["OWASP Top 10","Vulnerabilities","Threat Modeling","Risk Assessment","DSA Strings","Aptitude"],
      ["Penetration Testing","Kali Linux","Nmap","Burp Suite","DSA Recursion","Communication"],
      ["Web Security","XSS","CSRF","SQL Injection","DSA Linked List","Aptitude"],
      ["Authentication Security","OAuth","JWT","Encryption","DSA Stack","Presentation"],
      ["Network Security","Firewalls","IDS/IPS","VPN","DSA Queue","Probability"],
      ["Cloud Security","IAM","Monitoring","Incident Response","DSA Trees","Interview"],
      ["SIEM","Log Analysis","Threat Hunting","Malware Basics","DSA Binary Search","DI"],
      ["DevSecOps","Secure SDLC","Code Review","Automation","DSA Sorting","HR"],
      ["Advanced Cryptography","Zero Trust","Compliance","Forensics","DSA DP","Reasoning"],
      ["Capstone Security Project","Testing","Report Writing","Mitigation","Docs","DSA Graphs","Mock"],
      ["Revision","Case Studies","Advanced Attacks","Defense Strategy","Portfolio","Mixed DSA","Final Interview"],
    ],
  },
  {
    role: "QA / Test Engineer",
    weeks: [
      ["Testing Basics","SDLC","STLC","Bug Lifecycle","DSA Arrays","Soft Skills"],
      ["Manual Testing","Test Cases","Test Plans","Reporting","DSA Strings","Aptitude"],
      ["Automation Basics","Selenium","Cypress","Locators","DSA Recursion","Communication"],
      ["Advanced Automation","Framework Design","POM","Data Driven","DSA Linked List","Aptitude"],
      ["API Testing","Postman","Rest Assured","Mocking","DSA Stack","Presentation"],
      ["Performance Testing","JMeter","Load Testing","Stress Testing","DSA Queue","Probability"],
      ["CI/CD Integration","GitHub Actions","Docker","Deployment","DSA Trees","Interview"],
      ["Security Testing","OWASP","Vulnerability Testing","Reports","DSA Binary Search","DI"],
      ["Mobile Testing","Cross Browser","Compatibility","Regression","DSA Sorting","HR"],
      ["Advanced Testing","BDD","Cucumber","TDD","DSA DP","Reasoning"],
      ["Capstone QA Project","Automation Suite","Optimization","Docs","Reporting","DSA Graphs","Mock"],
      ["Revision","Advanced Scenarios","Case Studies","Portfolio","Interview Prep","Mixed DSA","Final Interview"],
    ],
  },
  {
    role: "Site Reliability Engineer (SRE)",
    weeks: [
      ["Linux","Networking","System Basics","Git","DSA Arrays","Soft Skills"],
      ["Monitoring Basics","Prometheus","Grafana","SLI/SLO","DSA Strings","Aptitude"],
      ["CI/CD","Docker","Kubernetes","Scaling","DSA Recursion","Communication"],
      ["Cloud Basics","Load Balancing","Auto Scaling","High Availability","DSA Linked List","Aptitude"],
      ["Incident Mgmt","On Call Practices","Root Cause Analysis","Runbooks","DSA Stack","Presentation"],
      ["Logging","ELK Stack","Tracing","Alerting","DSA Queue","Probability"],
      ["Performance Tuning","Capacity Planning","Cost Optimization","Backup","DSA Trees","Interview"],
      ["Security Basics","IAM","Compliance","Risk Mgmt","DSA Binary Search","DI"],
      ["Automation","Terraform","Scripting","IaC","DSA Sorting","HR"],
      ["Advanced Scalability","Distributed Systems","Chaos Engineering","Reliability","DSA DP","Reasoning"],
      ["Capstone Infra Project","Testing","Optimization","Deployment","Docs","DSA Graphs","Mock"],
      ["Revision","Advanced Architecture","Portfolio","Case Studies","Interview Q&A","Mixed DSA","Final Interview"],
    ],
  },
];

async function main() {
  const args = process.argv.slice(2);
  const hasFlag = (flag: string) => args.includes(flag);

  const argUriIndex = args.findIndex((a) => a === "--uri");
  const uriFromFlag = argUriIndex >= 0 ? args[argUriIndex + 1] : undefined;
  const uriFromPositional = args.find((a) => typeof a === "string" && a.startsWith("mongodb://"));
  const uri = uriFromFlag || uriFromPositional || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MongoDB URI. Provide --uri <mongodb-uri> or set MONGODB_URI.");
  }

  await mongoose.connect(forceMongoDbName(uri, "placeprep"), { serverSelectionTimeoutMS: 10_000 });

  const seedAllDatasetRoles = hasFlag("--all");
  const force = hasFlag("--force");

  let upserted = 0;
  for (const r of roleRoadmaps) {
    const weeks: RoadmapPlanWeek[] = r.weeks.map((days, idx) => toWeek(idx + 1, days));

    await RoadmapTemplate.findOneAndUpdate(
      { careerPath: r.role },
      {
        $set: {
          careerPath: r.role,
          provider: "deterministic",
          generatedAt: new Date(),
          version: 1,
          weeks,
        },
      },
      { upsert: true, new: true }
    );

    upserted += 1;
  }

  let createdFromDataset = 0;
  let skippedExisting = 0;
  if (seedAllDatasetRoles) {
    const datasetPaths = await getCareerPathsFromDataset();
    for (const careerPath of datasetPaths) {
      const existing = await RoadmapTemplate.findOne({ careerPath }).lean();
      if (existing?.weeks?.length && !force) {
        skippedExisting += 1;
        continue;
      }

      // Use shared creator (deterministic + stored in DB)
      const tpl = await getOrCreateRoadmapTemplateWeeks(careerPath);
      if (existing && force) {
        await RoadmapTemplate.findOneAndUpdate(
          { careerPath },
          {
            $set: {
              careerPath,
              provider: tpl.provider,
              generatedAt: new Date(),
              version: (existing as any)?.version ? Number((existing as any).version) + 1 : 1,
              weeks: tpl.weeks,
            },
          },
          { upsert: true, new: true }
        );
      }

      if (!existing) createdFromDataset += 1;
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seeded/updated ${upserted} static roadmap templates.` +
      (seedAllDatasetRoles
        ? ` Dataset roles: created ${createdFromDataset}, skipped ${skippedExisting}${force ? ", forced updates enabled" : ""}.`
        : "")
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
