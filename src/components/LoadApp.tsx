import React, { ReactNode } from 'react';

interface LoadAppProps {
    children: ReactNode;
}

export default function LoadApp({ children }: LoadAppProps) {
    return <>{children}</>;
}
