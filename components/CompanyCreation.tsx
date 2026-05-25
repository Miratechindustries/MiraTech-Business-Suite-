'use client';

import { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function CompanyCreation() {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      setError('Company name is required');
      return;
    }
    try {
      await addDoc(collection(db, 'companies'), { name, createdAt: new Date().toISOString() });
      setName('');
      alert('Company created successfully!');
    } catch (err) {
      setError('Failed to create company');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Create New Company</h2>
      <form onSubmit={handleCreate} className="space-y-4 border p-4 rounded-lg">
        <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Company Name" 
            className="border p-2 w-full" 
        />
        <button type="submit" className="bg-blue-600 text-white p-2 rounded">Create Company</button>
        {error && <p className="text-red-500">{error}</p>}
      </form>
    </div>
  );
}
