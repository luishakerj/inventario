import pandas as pd

xls = pd.ExcelFile('INVENTARIO (LICC - CIRNA) 2026 - 17082026.xlsx')

for sheet in xls.sheet_names:
    df = pd.read_excel(xls, sheet_name=sheet, header=None, nrows=15)
    print('=' * 80)
    print('SHEET:', sheet)
    for i, row in df.iterrows():
        vals = []
        for c in df.columns:
            v = row[c]
            if pd.notna(v):
                vals.append(f'[{c}]={v!r}')
        if vals:
            print(f'  row {i}: ' + ' | '.join(vals))
