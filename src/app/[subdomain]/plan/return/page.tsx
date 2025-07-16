'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function PaymentReturnPage() {
    const searchParams = useSearchParams();
    const status = searchParams.get('status');

    useEffect(() => {
        // Attempt to close the window. This works best if the window was opened via window.open()
        // Some browsers might prevent this, so the message is important as a fallback.
        setTimeout(() => window.close(), 1000);
    }, []);

    const getMessage = () => {
        switch (status) {
            case 'success':
                return 'Pagamento bem-sucedido! Esta aba será fechada em instantes.';
            case 'failure':
                return 'O pagamento falhou. Você pode fechar esta aba e tentar novamente.';
            case 'pending':
                return 'Seu pagamento está pendente. Avisaremos quando for confirmado. Você já pode fechar esta aba.';
            default:
                return 'Processando...';
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            fontFamily: 'sans-serif',
            backgroundColor: '#f0f2f5',
            color: '#333',
            textAlign: 'center',
            padding: '20px'
        }}>
            <Loader2 className="h-12 w-12 animate-spin mb-4" />
            <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>{getMessage()}</h1>
            <p style={{ fontSize: '16px' }}>Se a aba não fechar automaticamente, você pode fechá-la manualmente.</p>
        </div>
    );
} 