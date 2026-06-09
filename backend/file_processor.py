import zipfile
import io
import os
from pdf_processor import PDFProcessor

class FileProcessor:
    def __init__(self):
        self.pdf_processor = PDFProcessor()
    
    def extract_text_from_zip(self, zip_file):
        """Extract text content from a zip file containing PDFs or text files"""
        try:
            file_bytes = zip_file.read()
            zip_ref = zipfile.ZipFile(io.BytesIO(file_bytes), 'r')
            
            all_text = []
            file_names = []
            
            for file_info in zip_ref.infolist():
                if file_info.is_dir():
                    continue
                    
                file_name = file_info.filename.lower()
                
                # Extract PDF files
                if file_name.endswith('.pdf'):
                    try:
                        with zip_ref.open(file_info) as file:
                            file_content = file.read()
                            text = self.pdf_processor._extract_with_pypdf(file_content)
                            if text and len(text.strip()) > 50:
                                all_text.append(text)
                                file_names.append(file_info.filename)
                            else:
                                # Fallback to PDFMiner
                                text = self.pdf_processor._extract_with_pdfminer(file_content)
                                if text and len(text.strip()) > 0:
                                    all_text.append(text)
                                    file_names.append(file_info.filename)
                    except Exception as e:
                        print(f"Error extracting {file_info.filename}: {e}")
                        continue
                
                # Extract text files
                elif file_name.endswith('.txt') or file_name.endswith('.md'):
                    try:
                        with zip_ref.open(file_info) as file:
                            text = file.read().decode('utf-8', errors='ignore')
                            if text and len(text.strip()) > 10:
                                all_text.append(text)
                                file_names.append(file_info.filename)
                    except Exception as e:
                        print(f"Error extracting {file_info.filename}: {e}")
                        continue
            
            zip_ref.close()
            
            if all_text:
                combined_text = "\n\n".join(all_text)
                return {
                    'success': True,
                    'content': combined_text,
                    'files_processed': file_names,
                    'total_files': len(file_names)
                }
            else:
                return {
                    'success': False,
                    'error': 'No readable content found in the zip file. Please ensure it contains PDF or text files.'
                }
                
        except zipfile.BadZipFile:
            return {
                'success': False,
                'error': 'Invalid zip file format'
            }
        except Exception as e:
            print(f"Error processing zip file: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def extract_text_from_file(self, file):
        """Extract text from a single file (PDF or text)"""
        try:
            file_name = file.filename.lower()
            
            if file_name.endswith('.pdf'):
                text = self.pdf_processor.extract_text_from_pdf(file)
                if text:
                    return {
                        'success': True,
                        'content': text,
                        'files_processed': [file.filename],
                        'total_files': 1
                    }
                else:
                    return {
                        'success': False,
                        'error': 'Could not extract text from PDF'
                    }
            
            elif file_name.endswith('.txt') or file_name.endswith('.md'):
                text = file.read().decode('utf-8', errors='ignore')
                if text and len(text.strip()) > 10:
                    return {
                        'success': True,
                        'content': text,
                        'files_processed': [file.filename],
                        'total_files': 1
                    }
                else:
                    return {
                        'success': False,
                        'error': 'File is empty or contains no readable text'
                    }
            
            else:
                return {
                    'success': False,
                    'error': 'Unsupported file format. Please upload PDF, TXT, or ZIP files.'
                }
                
        except Exception as e:
            print(f"Error processing file: {e}")
            return {
                'success': False,
                'error': str(e)
            }
