'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import LegalDocumentView from '../../components/LegalDocumentView';

function LegalContent() {
  const searchParams = useSearchParams();
  const docParam = searchParams.get('doc') || 'privacy-policy';

  return <LegalDocumentView initialSlug={docParam} />;
}

export default function LegalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Loading MiraTech Legal Center...
          </p>
        </div>
      </div>
    }>
      <LegalContent />
    </Suspense>
  );
}
