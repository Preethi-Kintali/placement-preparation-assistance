## Personalized Placement Assistance System (Placement Prep)

This repository contains **Placement Prep**, a personalized placement assistance system that helps students prepare for technical and non‑technical interviews.

The app combines curated question banks, ML‑based models, and a modern React frontend to deliver customized practice for different job domains (e.g., full‑stack development, data science, AI, cybersecurity, and more).

---

## Features

- Domain‑wise interview question banks (technical, aptitude, soft skills)
- ML models for question recommendation (see `ml/` and `datasets/`)
- Web dashboard for practicing and tracking preparation
- Backend API (server directory) for serving questions and ML outputs
- Modern UI built with React, TypeScript, Tailwind CSS, and shadcn‑ui

---

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn‑ui
- **Backend**: Node.js/TypeScript (under `server/`)
- **ML / Data**: Python scripts and models in `ml/`, CSV datasets in `datasets/`

---

## Getting Started (Frontend)

1. Install Node.js (LTS) if you don’t have it.
2. Install dependencies:

	```sh
	npm install
	```

3. Start the frontend dev server:

	```sh
	npm run dev
	```

4. Open the URL shown in the terminal (usually `http://localhost:5173`).

---

## Getting Started (Backend API)

1. Navigate to the `server` folder:

	```sh
	cd server
	```

2. Install backend dependencies:

	```sh
	npm install
	```

3. Start the backend dev server:

	```sh
	npm run dev
	```

The frontend will communicate with this backend for data and ML‑driven recommendations (check `.env` and server docs for configuration).

---

## ML Models & Datasets

- Question datasets live in the `datasets/` folder.
- Trained models and training scripts are under `ml/`.
- See `ml/README.md` for more details on training and evaluation.

---

## Contributing / Customization

- Update questions in `datasets/` to adjust coverage.
- Tune or retrain models in `ml/` to improve recommendations.
- Modify UI components in `src/` to change the user experience.

Feel free to adapt this project to your institution’s or personal placement preparation needs.
