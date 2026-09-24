import pandas as pd
import json
import re
from datetime import datetime


def generar_padron_html():
    # 1. Cargar tus productos desde el JSON
    with open("products.json", "r", encoding="utf-8") as f:
        productos = json.load(f)

    # 2. Cabecera del Padrón
    fecha_hoy = datetime.now().strftime("%d/%m/%Y")
    html = f"""
<div class="padron-header">
  <h2>PADRÓN DE PRODUCTOS - INVENTARIO</h2>
  <p>Fecha de emisión: {fecha_hoy}</p>
</div>
<table class="tabla-padron">
  <thead>
    <tr>
      <th>N°</th>
      <th>Código</th>
      <th>Nombre / Descripción</th>
      <th>Categoría</th>
      <th>Cantidad</th>
      <th>Unidad</th>
    </tr>
  </thead>
  <tbody>
"""

    # 3. Generar filas dinámicamente
    for i, prod in enumerate(productos, start=1):
        html += f"""
    <tr>
      <td>{i}</td>
      <td>{prod.get('codigo', '-')}</td>
      <td>{prod.get('nombre', prod.get('descripcion', '-'))}</td>
      <td>{prod.get('categoria', '-')}</td>
      <td>{prod.get('cantidad', prod.get('stock', 0))}</td>
      <td>{prod.get('unidad', '-')}</td>
    </tr>
"""

    # 4. Cierre y firma
    html += """
  </tbody>
</table>
<div class="padron-firma">
  <p>Firma Responsable: _________________________</p>
</div>
"""
    return html

# Si quieres probarlo directo desde Python
if __name__ == "__main__":
    padron = generar_padron_html()
    with open("padron_generado.html", "w", encoding="utf-8") as f:
        f.write(padron)
    print("✅ Padrón generado: padron_generado.html")


xls = pd.ExcelFile('INVENTARIO (LICC - CIRNA) 2026 - 17082026.xlsx')

CATEGORY_MAP = {
    'SOLVENTES': 'Solventes',
    'CIDOS': 'Acido',
    'BASES Y SALES': 'Bases y sales',
    'POLMEROS': 'Polimeros',
    'VENCIDOS': 'Vencidos',
    'CONGELADOS Y REFRIGERADOS': 'Congelados y refrigerador',
    'EQUIPOS': 'Equipos',
    'MATERIALES DE LAB': 'Materiales de laboratorio',
    'MATERIALES DE LIMPIEZA': 'Materiales de limpieza',
    'ARTICULOS DE OFICINA': 'Articulos de oficina',
    'OTROS': 'Otros',
    'PRO.FREJOL': 'Pro frejol',
    'PRO FREJOL': 'Pro frejol',
}

def get_category(sheet_name):
    upper = sheet_name.strip().upper()
    for k, v in CATEGORY_MAP.items():
        if k in upper:
            return v
    return sheet_name

def scalar_isna(val):
    """Safe scalar isna — won't raise on ambiguous Series."""
    if val is None:
        return True
    if isinstance(val, float) and val != val:  # NaN check
        return True
    if isinstance(val, pd.Series):
        return False  # Treat a Series as not-NA (shouldn't happen)
    try:
        return bool(pd.isna(val))
    except (ValueError, TypeError):
        return False

def get_date(val):
    if scalar_isna(val): return ''
    if isinstance(val, datetime): return val.strftime('%Y-%m-%d')
    s = str(val).strip()
    return '' if s.upper() in ['SF', '-', '', 'NAN'] else s

def get_str(val):
    if scalar_isna(val): return ''
    s = str(val).strip()
    return '' if s.upper() == 'NAN' else s

def get_cell(row, col):
    """Get a single scalar value from a row by column name, safely."""
    if col is None:
        return None
    try:
        val = row[col]
        # If somehow we get a Series, take the first element
        if isinstance(val, pd.Series):
            val = val.iloc[0] if len(val) > 0 else None
        return val
    except Exception:
        return None


def process_standard_sheet(df, category, id_counter):
    """Process sheets with the standard reactivos layout."""
    header_row = None
    for i, row in df.iterrows():
        if any(str(v).strip().upper().startswith('NOMBRE') for v in row.values if pd.notna(v)):
            header_row = i
            break

    if header_row is None:
        return [], id_counter

    df = df.copy()
    df.columns = df.iloc[header_row]
    df = df[header_row + 1:]

    name_col  = next((c for c in df.columns if pd.notna(c) and 'NOMBRE' in str(c).upper()), None)
    prod_col  = next((c for c in df.columns if pd.notna(c) and 'PRODUCCI' in str(c).upper()), None)
    exp_col   = next((c for c in df.columns if pd.notna(c) and 'VENC' in str(c).upper()), None)
    und_col   = next((c for c in df.columns if pd.notna(c) and str(c).strip().upper() == 'UND'), None)
    qty_col   = next((c for c in df.columns if pd.notna(c) and 'CANTIDAD' in str(c).upper()), None)
    marca_col = next((c for c in df.columns if pd.notna(c) and 'MARCA' in str(c).upper()), None)
    lote_col  = next((c for c in df.columns if pd.notna(c) and 'LOTE' in str(c).upper()), None)
    desc_col  = next((c for c in df.columns if pd.notna(c) and 'DESCRI' in str(c).upper()), None)

    products = []
    for _, row in df.iterrows():
        name = get_cell(row, name_col)
        if scalar_isna(name) or str(name).strip() == '' or str(name).strip().upper() in ['N', 'NAN']:
            continue

        und_raw = get_cell(row, und_col)
        stock = 0
        if not scalar_isna(und_raw):
            try: stock = int(float(und_raw))
            except: pass

        qty_raw = get_cell(row, qty_col)
        unit_str = ''
        if not scalar_isna(qty_raw):
            unit_str = str(qty_raw).strip()
            if unit_str.upper() == 'NAN':
                unit_str = ''

        product = {
            'id': id_counter,
            'name': str(name).strip(),
            'category': category,
            'stock': stock,
            'unit': unit_str,
            'location': get_str(get_cell(row, marca_col)),
            'lote': get_str(get_cell(row, lote_col)),
            'prodDate': get_date(get_cell(row, prod_col)),
            'expDate': get_date(get_cell(row, exp_col)),
            'desc': get_str(get_cell(row, desc_col)),
            'image': None
        }
        products.append(product)
        id_counter += 1

    return products, id_counter


def process_simple_sheet(df, category, id_counter, name_kw='ART', qty_kw='CANTIDAD'):
    """Process sheets with simple 2-column layouts (Oficina, Otros, etc.)."""
    header_row = None
    for i, row in df.iterrows():
        vals_upper = [str(v).strip().upper() for v in row.values if pd.notna(v)]
        if any(name_kw in v for v in vals_upper):
            header_row = i
            break

    if header_row is None:
        return [], id_counter

    df = df.copy()
    df.columns = df.iloc[header_row]
    df = df[header_row + 1:]

    # Try multiple name/qty column variants
    name_col = next((c for c in df.columns if pd.notna(c) and name_kw in str(c).strip().upper()), None)
    qty_col  = next((c for c in df.columns if pd.notna(c) and qty_kw in str(c).strip().upper()), None)

    if name_col is None:
        return [], id_counter

    products = []
    for _, row in df.iterrows():
        name = get_cell(row, name_col)
        if scalar_isna(name) or str(name).strip() == '' or str(name).strip().upper() in ['N', 'NAN']:
            continue

        qty_raw = get_cell(row, qty_col)
        stock = 0
        if not scalar_isna(qty_raw):
            try: stock = int(float(qty_raw))
            except: pass

        product = {
            'id': id_counter,
            'name': str(name).strip(),
            'category': category,
            'stock': stock,
            'unit': '',
            'location': '',
            'lote': '',
            'prodDate': '',
            'expDate': '',
            'desc': '',
            'image': None
        }
        products.append(product)
        id_counter += 1

    return products, id_counter


def process_lab_materials_sheet(df, category, id_counter):
    """Hoja MATERIALES DE LAB: encabezado con 'NOMBRE DE MATERIALES (VIDRIO)'.
    Columnas reales:
      B = NOMBRE DE MATERIALES (VIDRIO) -> nombre
      C = MEDIDAS/VOLUMEN               -> unidad/medida (ej. "5000ml")
      D = MARCA                         -> marca (location)
      E = UND                           -> conteo (stock)
    La medida (mL/g/etc.) estaba quedando vacia porque la hoja caia en
    process_standard_sheet, que no busca 'MEDIDAS/VOLUMEN'.
    """
    header_row = None
    for i, row in df.iterrows():
        if any(pd.notna(v) and 'NOMBRE' in str(v).strip().upper() for v in row.values):
            header_row = i
            break
    if header_row is None:
        return [], id_counter
    df = df.copy()
    df.columns = df.iloc[header_row]
    df = df[header_row + 1:]

    def find(*keywords):
        for c in df.columns:
            if pd.isna(c):
                continue
            cu = str(c).strip().upper()
            if any(k in cu for k in keywords):
                return c
        return None
    name_col = find('NOMBRE')
    unit_col = find('MEDIDAS', 'VOLUMEN')
    marca_col = find('MARCA')
    stock_col = find('UND')

    products = []
    for _, row in df.iterrows():
        name = get_cell(row, name_col)
        if scalar_isna(name):
            continue
        name_str = str(name).strip()
        if name_str == '' or name_str.upper() in ['N', 'NAN', 'NOMBRE DE MATERIALES (VIDRIO)']:
            continue
        # La medida del material (ej. "5000ml") es la unidad a mostrar.
        unit_raw = get_cell(row, unit_col)
        unit_str = '' if scalar_isna(unit_raw) else str(unit_raw).strip()
        if unit_str.upper() in ['NAN', '-']:
            unit_str = ''

        # UND es el conteo de piezas que hay.
        stock_raw = get_cell(row, stock_col)
        stock = 0
        if not scalar_isna(stock_raw):
            try:
                stock = int(float(stock_raw))
            except (ValueError, TypeError):
                pass
        product = {
            'id': id_counter,
            'name': name_str,
            'category': category,
            'stock': stock,
            'unit': unit_str,
            'location': get_str(get_cell(row, marca_col)),
            'lote': '',
            'prodDate': '',
            'expDate': '',
            'desc': '',
            'image': None
        }
        products.append(product)
        id_counter += 1
    return products, id_counter

def process_frejol_sheet(df, category, id_counter):
    # Hoja PRO.FREJOL: su encabezado esta en la fila que contiene
    # "NOMBRE DE REACTIVOS". Columnas reales:
    #   B=NOMBRE DE REACTIVOS, C=DESCRIPCION, D=MARCA, E=LOTE/COD,
    #   F=FECHA DE PRODUCCION, G=FECHA DE VENCIMIENTO, H=UND,
    #   I=CANTIDAD (medida del envase), K=TOTAL DE UNIDADES (cuantos hay)
    # La cantidad real va en "TOTAL DE UNIDADES" y la unidad en "UND".
    header_row = None
    for i, row in df.iterrows():
        for v in row.values:
            if pd.notna(v) and 'NOMBRE' in str(v).strip().upper():
                header_row = i
                break
        if header_row is not None:
            break
    if header_row is None:
        return [], id_counter
    df = df.copy()
    df.columns = df.iloc[header_row]
    df = df[header_row + 1:]

    def find(*keywords):
        for c in df.columns:
            if pd.isna(c):
                continue
            cu = str(c).strip().upper()
            if any(k in cu for k in keywords):
                return c
        return None
    name_col  = find('NOMBRE')
    marca_col = find('MARCA')
    lote_col  = find('LOTE')
    prod_col  = find('PRODUCCI')
    exp_col   = find('VENC')
    und_col   = find('UND')
    qty_col   = find('TOTAL DE UNIDADES', 'TOTAL')
    med_col   = find('CANTIDAD')
    desc_col  = find('DESCRIP')

    products = []
    for _, row in df.iterrows():
        name = get_cell(row, name_col)
        if scalar_isna(name):
            continue
        name_str = str(name).strip()
        if name_str == '' or name_str.upper() in ['N', 'NAN', 'NOMBRE DE REACTIVOS']:
            continue
        # Cantidad real = "TOTAL DE UNIDADES" (K); si no hay, usar "CANTIDAD".
        qty_raw = get_cell(row, qty_col)
        if scalar_isna(qty_raw):
            qty_raw = get_cell(row, med_col)
        stock = 0
        if not scalar_isna(qty_raw):
            try:
                stock = int(float(qty_raw))
            except (ValueError, TypeError):
                pass
        # Unidad: "CANTIDAD" (I) es la medida del envase (ej. "5 g", "250 g").
        # "UND" (H) es medida o un numero suelto; solo se usa si CANT esta vacio
        # y UND no es un numero puro (si es numero, ese valor es el stock).
        und_raw = get_cell(row, und_col)
        unit_str = '' if scalar_isna(und_raw) else str(und_raw).strip()
        if unit_str.upper() in ['NAN', '-']:
            unit_str = ''
        med_raw = get_cell(row, med_col)
        med_str = '' if scalar_isna(med_raw) else str(med_raw).strip()
        if med_str.upper() in ['NAN', '-']:
            med_str = ''
        # Si UND es un numero puro ("1", "2"), es conteo, no medida.
        if unit_str and re.fullmatch(r'\d+(?:[.,]\d+)?', unit_str):
            unit_str = ''
        unit_final = med_str if med_str else unit_str

        product = {
            'id': id_counter,
            'name': name_str,
            'category': category,
            'stock': stock,
            'unit': unit_final,
            'location': get_str(get_cell(row, marca_col)),
            'lote': get_str(get_cell(row, lote_col)),
            'prodDate': get_date(get_cell(row, prod_col)),
            'expDate': get_date(get_cell(row, exp_col)),
            'desc': get_str(get_cell(row, desc_col)),
            'image': None
        }
        products.append(product)
        id_counter += 1
    return products, id_counter
# ---- MAIN LOOP ----
all_products = []
id_counter = 1

for sheet in xls.sheet_names:
    category = get_category(sheet)
    df_raw = pd.read_excel(xls, sheet_name=sheet, header=None)
    sheet_upper = sheet.strip().upper()

    if 'OFICINA' in sheet_upper:
        prods, id_counter = process_simple_sheet(df_raw, category, id_counter, name_kw='ART', qty_kw='CANTIDAD')
    elif 'LAB' in sheet_upper and 'LIMPIEZA' not in sheet_upper:
        # MATERIALES DE LAB: la medida del envase (MEDIDAS/VOLUMEN, ej. "5000ml")
        # es la unidad; UND es el conteo de piezas.
        prods, id_counter = process_lab_materials_sheet(df_raw, category, id_counter)
    elif 'FREJOL' in sheet_upper or 'FRÉJOL' in sheet_upper:
        # PRO.FREJOL: layout por columnas fijas, sin fila de encabezado 'NOMBRE'.
        prods, id_counter = process_frejol_sheet(df_raw, category, id_counter)
    elif 'OTROS' in sheet_upper:
        # OTROS has two side-by-side tables; process col-2 (ARTÍCULOS) and col-6 (NOMBRE)
        prods1, id_counter = process_simple_sheet(df_raw, category, id_counter, name_kw='ART', qty_kw='CANTIDAD')
        prods2, id_counter = process_simple_sheet(df_raw, category, id_counter, name_kw='NOMBRE', qty_kw='CANTIDAD')
        prods = prods1 + prods2
    else:
        prods, id_counter = process_standard_sheet(df_raw, category, id_counter)

    all_products.extend(prods)
    print(f'{sheet}: {len(prods)} productos')

with open('products.json', 'w', encoding='utf-8') as f:
    json.dump(all_products, f, ensure_ascii=False, indent=4)
print(f'\n✅ Total: {len(all_products)} productos exportados a products.json')
