# Dataset Instructions — CardioVision 3D AI

The Z-Alizadeh Sani dataset CSV is not committed to this repository.

## Dataset
- Source: UCI Machine Learning Repository, Extension of the Z-Alizadeh Sani Dataset
- Expected file: `data/Z-Alizadeh-sani-dataset.csv`
- Records: 303 patients
- Columns: 59
- Targets: `Cath` (overall CAD), `LAD`, `LCX`, and `RCA` (vessel-specific stenosis)

## Prepare the dataset
1. Obtain the dataset from its original source, subject to its applicable license and terms.
2. Place the CSV at `data/Z-Alizadeh-sani-dataset.csv`.
3. Install dependencies and configure the database using the main README.
4. Train the model:

    npm run train -- data/Z-Alizadeh-sani-dataset.csv

The training pipeline excludes `Cath`, `LAD`, `LCX`, and `RCA` from input features to prevent target leakage.

The cohort is small, so metrics are preliminary and do not establish clinical validity. This is a research/demo project, not a medical diagnostic tool.
