const roleInput = document.getElementById("roleInput");
const suggestBtn = document.getElementById("suggestBtn");
const jobsBtn = document.getElementById("jobsBtn");
const rolesList = document.getElementById("rolesList");
const jobsList = document.getElementById("jobsList");
const statusBox = document.getElementById("statusBox");

function setStatus(value) {
  statusBox.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function renderRoles(roles) {
  rolesList.innerHTML = "";
  roles.forEach((role) => {
    const li = document.createElement("li");
    li.textContent = role;
    li.style.cursor = "pointer";
    li.onclick = () => {
      roleInput.value = role;
    };
    rolesList.appendChild(li);
  });
}

function renderJobs(jobs) {
  jobsList.innerHTML = "";

  if (!jobs.length) {
    jobsList.textContent = "No jobs found.";
    return;
  }

  jobs.forEach((job) => {
    const card = document.createElement("div");
    card.className = "job-card";

    const title = document.createElement("div");
    title.className = "job-title";
    title.textContent = `${job.title} - ${job.company}`;

    const meta = document.createElement("div");
    meta.className = "job-meta";
    meta.textContent = `${job.location} | ${job.posted || "N/A"}`;

    card.appendChild(title);
    card.appendChild(meta);

    if (job.applyLink) {
      const link = document.createElement("a");
      link.href = job.applyLink;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Apply Link";
      card.appendChild(link);
    }

    jobsList.appendChild(card);
  });
}

async function getJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.details || "Request failed");
  }
  return data;
}

suggestBtn.addEventListener("click", async () => {
  try {
    const role = roleInput.value.trim();
    if (!role) {
      throw new Error("Enter role first");
    }

    setStatus("Fetching role suggestions...");
    const data = await getJson(`/api/roles?q=${encodeURIComponent(role)}`);
    renderRoles(data.roles || []);
    setStatus(data);
  } catch (error) {
    setStatus({ error: error.message });
  }
});

jobsBtn.addEventListener("click", async () => {
  try {
    const role = roleInput.value.trim();
    if (!role) {
      throw new Error("Enter role first");
    }

    setStatus("Fetching jobs...");
    const data = await getJson(`/api/jobs?role=${encodeURIComponent(role)}`);
    renderJobs(data.jobs || []);
    setStatus(data);
  } catch (error) {
    setStatus({ error: error.message });
  }
});
