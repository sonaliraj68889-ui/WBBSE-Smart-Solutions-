import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Loader2 } from 'lucide-react';

function App() {
  const [subject, setSubject] = useState('English');
  const [paper, setPaper] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setPaper('');
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subject })
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate paper from server.');
      }
      setPaper(result.text);
    } catch (err: any) {
      setError(err.message || 'Failed to generate paper.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto font-sans">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-800">WBBSE Madhyamik Sample Paper Generator</h1>
        <p className="text-gray-600 mt-2">Generate 90-mark sample papers with alternative (OR) questions!</p>
      </header>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8 flex items-center justify-center gap-4">
        <select 
          className="border border-gray-300 rounded-lg px-4 py-2"
          value={subject} 
          onChange={e => setSubject(e.target.value)}
        >
          <option value="Hindi">Hindi</option>
          <option value="English">English</option>
          <option value="History">History</option>
          <option value="Geography">Geography</option>
          <option value="Mathematics">Mathematics</option>
          <option value="Physical Science">Physical Science</option>
          <option value="Life Science">Life Science</option>
        </select>
        <button 
          onClick={handleGenerate} 
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <><Loader2 className="animate-spin" size={18} /> Generating...</> : "Generate Paper"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-8 outline outline-1 outline-red-200">
          {error}
        </div>
      )}

      {paper && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 prose max-w-none">
          <ReactMarkdown>{paper}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

export default App;
