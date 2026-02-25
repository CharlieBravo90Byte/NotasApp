import pdfplumber

pdf_path = r"D:\06.-Proyectos\ProyectosInformatico\SoftKMC\NotasApp\pdf\202610CVE543.pdf"

with pdfplumber.open(pdf_path) as pdf:
    print(f"Total paginas: {len(pdf.pages)}")
    for i, page in enumerate(pdf.pages):
        text = page.extract_text()
        if text:
            print(f"\n{'='*60}")
            print(f"PAGINA {i+1}")
            print("="*60)
            print(text)
        tables = page.extract_tables()
        if tables:
            print(f"\n--- TABLAS pagina {i+1} ---")
            for ti, table in enumerate(tables):
                print(f"  Tabla {ti+1}:")
                for row in table:
                    print("  ", [str(c).strip() if c else "" for c in row])
