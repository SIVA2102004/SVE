import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { formatDate } from '../utils/formatters';
import { DocumentReceipt } from '../types';
import {
  FileText,
  Upload,
  Search,
  RefreshCw,
  ExternalLink,
  Trash2,
  FileCode,
  Image as ImageIcon,
} from 'lucide-react';

const Receipts: React.FC = () => {
  const [receipts, setReceipts] = useState<DocumentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Bill');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/documents');
      const list = Array.isArray(res.data) ? res.data : res.data?.receipts || [];
      const normalized = list.map((r: any) => ({
        ...r,
        filePath: r.fileUrl || r.filePath,
        fileType: r.mimeType || r.fileType || '',
      }));
      setReceipts(normalized);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert('Please choose a file to upload');
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title || file.name);
    formData.append('category', category);

    try {
      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert('Document uploaded to secure vault!');
      setTitle('');
      setFile(null);
      await fetchReceipts();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const filtered = receipts.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Receipts & Document Vault</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Secure digital storage for purchase invoices, tax receipts, warranties, and supplier bills
          </p>
        </div>
      </div>

      {/* Upload Box */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center space-x-2">
          <Upload className="w-4 h-4 text-brand-600" />
          <span>Upload New Bill or Receipt</span>
        </h3>
        <form onSubmit={handleUpload} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Document Title</label>
            <input
              type="text"
              placeholder="e.g. GST invoice Oct 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              <option value="Bill">Purchase Bill</option>
              <option value="Receipt">Tax Receipt</option>
              <option value="Warranty">Warranty Card</option>
              <option value="Contract">Contract / Agreement</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Select File (JPG, PNG, PDF)</label>
            <input
              type="file"
              required
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
              className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={uploading}
              className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Save Document'}
            </button>
          </div>
        </form>
      </div>

      {/* Receipts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-600" />
            <span>Loading documents...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 font-medium bg-white rounded-2xl border border-slate-200/80">
            No documents stored yet.
          </div>
        ) : (
          filtered.map((r) => (
            <div
              key={r.id}
              className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                    {r.category}
                  </span>
                  <span className="text-[10px] text-slate-400">{formatDate(r.createdAt)}</span>
                </div>
                <div className="h-24 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center my-2">
                  {r.fileType.includes('image') ? (
                    <ImageIcon className="w-10 h-10 text-brand-400" />
                  ) : (
                    <FileText className="w-10 h-10 text-emerald-400" />
                  )}
                </div>
                <h4 className="font-bold text-slate-800 text-xs truncate mt-2">{r.title}</h4>
                <p className="text-[10px] text-slate-400">{(r.fileSize / 1024).toFixed(1)} KB</p>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <a
                  href={`http://localhost:5000${r.filePath}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brand-600 font-bold hover:underline flex items-center space-x-1"
                >
                  <span>View Proof</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Receipts;
