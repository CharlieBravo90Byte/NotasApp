import pdfplumber

pdf_path = r"D:\06.-Proyectos\ProyectosInformatico\SoftKMC\NotasApp\pdf\202610CVE543.pdf"

with pdfplumber.open(pdf_path) as pdf:
    print(f"Total paginas: {len(pdf.pages)}\n")
    # Solo paginas 1-5
    for i in range(min(5, len(pdf.pages))):
        page = pdf.pages[i]
        text = page.extract_text() or ""
        print(f"====== PAGINA {i+1} ======")
        print(text[:3000])  # Limitar caracteres por pagina
        print()
