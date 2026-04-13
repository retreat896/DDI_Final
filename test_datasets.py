import zipfile
import glob
import pandas as pd

print("--- ZIP FILES ---")
for f in glob.glob("datasets/*.zip"):
    print(f"File: {f}")
    with zipfile.ZipFile(f, 'r') as z:
        print(" Contents:", z.namelist())
        
print("\n--- CSV FILES ---")
for f in glob.glob("datasets/*.csv"):
    print(f"File: {f}")
    try:
        df = pd.read_csv(f, nrows=2)
        print(" Columns:", df.columns.tolist())
        print(" Row 1:", df.iloc[0].to_dict() if len(df) > 0 else "Empty")
    except Exception as e:
        print(" Error:", e)
