import pdfplumber

pdf_path = r"D:\06.-Proyectos\ProyectosInformatico\SoftKMC\NotasApp\pdf\202610CVE543.pdf"

keywords = ["porcentaje", "ponderaci", "evaluaci", "catedra", "cátedra", "control", "examen", "taller", "laboratorio", "%", "nota", "promedio"]

with pdfplumber.open(pdf_path) as pdf:
    print(f"Total paginas: {len(pdf.pages)}\n")
    for i, page in enumerate(pdf.pages[:10]):  # Solo primeras 10 páginas
        text = page.extract_text() or ""
        text_lower = text.lower()
        has_keyword = any(kw in text_lower for kw in keywords)
        print(f"====== PAGINA {i+1} ======")
        print(text)
        tables = page.extract_tables()
        for j, table in enumerate(tables):
            print(f"  -- Tabla {j+1} --")
            for row in table:
                clean = [str(c or "").replace("\n", " ").strip() for c in row]
                if any(c for c in clean):
                    print("  |", " | ".join(clean), "|")
        print()
