import pdfplumber

pdf_path = r"D:\06.-Proyectos\ProyectosInformatico\SoftKMC\NotasApp\pdf\202610CVE543.pdf"

with pdfplumber.open(pdf_path) as pdf:
    # Paginas 3-7 que probablemente tienen los pesos de componentes
    for i in range(2, 7):
        page = pdf.pages[i]
        text = page.extract_text() or ""
        print(f"====== PAGINA {i+1} ======")
        # Solo mostrar si contiene palabras clave de pesos
        if any(kw in text.lower() for kw in ["ejercicio", "porcentaje", "peso", "componente", "40%", "30%", "20%"]):
            print(text)
        else:
            print("[Sin contenido relevante]")
        # Mostrar todas las tablas
        tables = page.extract_tables()
        for j, table in enumerate(tables):
            print(f"  -- Tabla {j+1} --")
            for row in table:
                clean = [str(c or "").replace("\n", " ").strip() for c in row]
                if any(c for c in clean):
                    print("  |", " | ".join(clean), "|")
        print()
