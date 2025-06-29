import React, { useState, useCallback } from 'react';
import { Upload, FileText, Download, CheckCircle, AlertCircle, X, RefreshCcw, Archive } from 'lucide-react';
import JSZip from 'jszip';

interface ProcessedFile {
  originalFile: File;
  originalName: string;
  newName: string;
  status: 'processed' | 'error';
  errorMessage?: string;
}

function App() {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreatingZip, setIsCreatingZip] = useState(false);
  const [uploadedZipName, setUploadedZipName] = useState<string>('');

  const processFileName = (fileName: string): { newName: string; error?: string } => {
    // Remove .pdf extension for processing
    const nameWithoutExt = fileName.replace(/\.pdf$/i, '');
    
    // Split by underscore and check if we have at least 5 parts (4 underscores)
    const parts = nameWithoutExt.split('_');
    
    if (parts.length < 5) {
      return { newName: fileName, error: 'Dateiname hat weniger als 4 Unterstriche "_"' };
    }
    
    // Take everything from the 5th part onwards (after the 4th underscore)
    const actualFileName = parts.slice(4).join('_');
    
    if (!actualFileName) {
      return { newName: fileName, error: 'Kein gültiger Dateiname nach dem 4. Unterstrich gefunden' };
    }
    
    // Check if it starts with a number followed by ) or is a word
    const startsWithNumber = /^\d+\)/.test(actualFileName);
    const startsWithWord = /^[a-zA-ZäöüÄÖÜß]/.test(actualFileName);
    
    if (!startsWithNumber && !startsWithWord) {
      return { newName: fileName, error: 'Dateiname entspricht nicht dem erwarteten Format (muss mit Zahl) oder Buchstabe beginnen)' };
    }
    
    return { newName: actualFileName + '.pdf' };
  };

  const extractPDFsFromZip = async (zipFile: File): Promise<File[]> => {
    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(zipFile);
      const pdfFiles: File[] = [];

      for (const [filename, file] of Object.entries(zipContent.files)) {
        if (!file.dir && filename.toLowerCase().endsWith('.pdf')) {
          const blob = await file.async('blob');
          const pdfFile = new File([blob], filename, { type: 'application/pdf' });
          pdfFiles.push(pdfFile);
        }
      }

      return pdfFiles;
    } catch (error) {
      console.error('Fehler beim Extrahieren der ZIP-Datei:', error);
      throw new Error('ZIP-Datei konnte nicht gelesen werden');
    }
  };

  const handleFiles = useCallback(async (fileList: FileList) => {
    setIsProcessing(true);
    const processedFiles: ProcessedFile[] = [];
    let zipName = '';
    
    try {
      for (const file of Array.from(fileList)) {
        if (file.name.toLowerCase().endsWith('.zip')) {
          // Handle ZIP file
          zipName = file.name.replace(/\.zip$/i, '');
          setUploadedZipName(zipName);
          
          try {
            const pdfFiles = await extractPDFsFromZip(file);
            
            if (pdfFiles.length === 0) {
              processedFiles.push({
                originalFile: file,
                originalName: file.name,
                newName: file.name,
                status: 'error',
                errorMessage: 'Keine PDF-Dateien in der ZIP-Datei gefunden'
              });
              continue;
            }

            // Process each PDF from the ZIP
            pdfFiles.forEach(pdfFile => {
              const result = processFileName(pdfFile.name);
              processedFiles.push({
                originalFile: pdfFile,
                originalName: pdfFile.name,
                newName: result.newName,
                status: result.error ? 'error' : 'processed',
                errorMessage: result.error
              });
            });

          } catch (error) {
            processedFiles.push({
              originalFile: file,
              originalName: file.name,
              newName: file.name,
              status: 'error',
              errorMessage: 'ZIP-Datei konnte nicht verarbeitet werden'
            });
          }
        } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          // Handle individual PDF file
          const result = processFileName(file.name);
          processedFiles.push({
            originalFile: file,
            originalName: file.name,
            newName: result.newName,
            status: result.error ? 'error' : 'processed',
            errorMessage: result.error
          });
        }
      }
      
      setFiles(prev => [...prev, ...processedFiles]);
    } catch (error) {
      console.error('Fehler beim Verarbeiten der Dateien:', error);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const onFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const downloadFile = (processedFile: ProcessedFile) => {
    const url = URL.createObjectURL(processedFile.originalFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = processedFile.newName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAllAsZip = async () => {
    const successfulFiles = files.filter(f => f.status === 'processed');
    if (successfulFiles.length === 0) return;

    setIsCreatingZip(true);
    
    try {
      const zip = new JSZip();
      
      // Add each file to the ZIP with the new name
      for (const file of successfulFiles) {
        const arrayBuffer = await file.originalFile.arrayBuffer();
        zip.file(file.newName, arrayBuffer);
      }
      
      // Generate the ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Determine ZIP filename
      let zipFileName = 'bAV-Angebot.zip';
      if (uploadedZipName) {
        zipFileName = `${uploadedZipName}.zip`;
      }
      
      // Create download link
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Fehler beim Erstellen der ZIP-Datei:', error);
      alert('Fehler beim Erstellen der ZIP-Datei. Bitte versuchen Sie es erneut.');
    } finally {
      setIsCreatingZip(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setFiles([]);
    setUploadedZipName('');
  };

  const successfulFiles = files.filter(f => f.status === 'processed');
  const errorFiles = files.filter(f => f.status === 'error');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <FileText className="h-12 w-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">PDF Dateinamen Editor</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Laden Sie Ihre PDF-Dateien oder ZIP-Ordner hoch und entfernen Sie automatisch Präfixe aus den Dateinamen. 
            Das Tool extrahiert den eigentlichen Dateinamen nach dem 4. Unterstrich und erstellt einen ZIP-Ordner mit allen bearbeiteten Dateien.
          </p>
        </div>

        {/* Upload Area */}
        <div className="mb-8">
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={`
              relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300
              ${isDragOver 
                ? 'border-blue-400 bg-blue-50 scale-[1.02]' 
                : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
              }
            `}
          >
            <input
              type="file"
              multiple
              accept=".pdf,.zip"
              onChange={onFileInputChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            <div className="flex flex-col items-center space-y-4">
              <div className={`p-4 rounded-full transition-colors duration-300 ${
                isDragOver ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
                <Upload className={`h-12 w-12 transition-colors duration-300 ${
                  isDragOver ? 'text-blue-600' : 'text-gray-400'
                }`} />
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  PDF-Dateien oder ZIP-Ordner hier ablegen oder klicken
                </h3>
                <p className="text-gray-500">
                  Unterstützt werden unbegrenzt viele PDF-Dateien oder ZIP-Ordner mit PDFs
                </p>
              </div>
              
              <div className="flex items-center space-x-4 text-sm text-gray-400">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span>PDF-Dateien</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Archive className="h-4 w-4" />
                  <span>ZIP-Ordner</span>
                </div>
              </div>
            </div>
            
            {isProcessing && (
              <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center rounded-xl">
                <div className="flex items-center space-x-3">
                  <RefreshCcw className="h-6 w-6 text-blue-600 animate-spin" />
                  <span className="text-gray-700 font-medium">Dateien werden verarbeitet...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Upload Info */}
        {uploadedZipName && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Archive className="h-5 w-5 text-blue-600" />
              <span className="text-blue-800 font-medium">
                ZIP-Ordner hochgeladen: <span className="font-bold">{uploadedZipName}.zip</span>
              </span>
            </div>
            <p className="text-blue-700 text-sm mt-1">
              Die bearbeiteten Dateien werden unter dem gleichen Namen heruntergeladen.
            </p>
          </div>
        )}

        {/* Statistics */}
        {files.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{files.length}</p>
                  <p className="text-sm text-gray-600">Dateien gesamt</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{successfulFiles.length}</p>
                  <p className="text-sm text-gray-600">Erfolgreich verarbeitet</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <AlertCircle className="h-8 w-8 text-red-600 mr-3" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{errorFiles.length}</p>
                  <p className="text-sm text-gray-600">Fehler</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-4 mb-8 justify-center">
            {successfulFiles.length > 0 && (
              <button
                onClick={downloadAllAsZip}
                disabled={isCreatingZip}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 shadow-sm hover:shadow-md disabled:cursor-not-allowed"
              >
                {isCreatingZip ? (
                  <>
                    <RefreshCcw className="h-5 w-5 animate-spin" />
                    <span>ZIP wird erstellt...</span>
                  </>
                ) : (
                  <>
                    <Archive className="h-5 w-5" />
                    <span>Als ZIP herunterladen ({successfulFiles.length} Dateien)</span>
                  </>
                )}
              </button>
            )}
            
            <button
              onClick={clearAll}
              className="flex items-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 shadow-sm hover:shadow-md"
            >
              <X className="h-5 w-5" />
              <span>Alle entfernen</span>
            </button>
          </div>
        )}

        {/* Files List */}
        {files.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Verarbeitete Dateien</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Original-Dateiname
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Neuer Dateiname
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aktionen
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {files.map((file, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {file.status === 'processed' ? (
                          <div className="flex items-center text-green-600">
                            <CheckCircle className="h-5 w-5 mr-2" />
                            <span className="text-sm font-medium">Erfolgreich</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-red-600">
                            <AlertCircle className="h-5 w-5 mr-2" />
                            <span className="text-sm font-medium">Fehler</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 break-all">{file.originalName}</div>
                        {file.errorMessage && (
                          <div className="text-xs text-red-600 mt-1">{file.errorMessage}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 break-all font-medium">
                          {file.newName}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center space-x-2">
                          {file.status === 'processed' && (
                            <button
                              onClick={() => downloadFile(file)}
                              className="text-blue-600 hover:text-blue-700 font-medium transition-colors duration-150"
                            >
                              Einzeln laden
                            </button>
                          )}
                          <button
                            onClick={() => removeFile(index)}
                            className="text-red-600 hover:text-red-700 font-medium transition-colors duration-150"
                          >
                            Entfernen
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-12 bg-blue-50 rounded-xl p-6 border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Wie funktioniert es?</h3>
          <div className="text-blue-800 space-y-2">
            <p>• <strong>Upload:</strong> Laden Sie einzelne PDF-Dateien oder ZIP-Ordner mit PDFs hoch</p>
            <p>• Das Tool sucht nach dem 4. Unterstrich "_" im Dateinamen (von vorne gezählt)</p>
            <p>• Alles vor diesem 4. Unterstrich wird entfernt (Name, Datum, Betrag, etc.)</p>
            <p>• Der verbleibende Teil muss mit einer Zahl gefolgt von ")" oder einem Buchstaben beginnen</p>
            <p>• Beispiel: "Max_Mustermann_01.01.2024_1500,00_1)_Beratungsdokumente.pdf" wird zu "1)_Beratungsdokumente.pdf"</p>
            <p>• <strong>Wichtig:</strong> Der Dateiname muss mindestens 4 Unterstriche enthalten</p>
            <p>• <strong>Download:</strong> Bei ZIP-Upload wird der gleiche Name verwendet, sonst "bAV-Angebot.zip"</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;