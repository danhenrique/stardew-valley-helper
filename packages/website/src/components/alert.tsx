import type React from 'react';

interface AlertProps {
  type: string;
  header: string;
  children: React.ReactNode;
}

// Used by the generated CognitoAuth component; styled with Tailwind utilities.
export const Alert: React.FC<AlertProps> = ({ type, header, children }) => (
  <div
    className={
      type === 'error'
        ? 'rounded-md bg-red-50 p-4 text-red-800'
        : 'rounded-md bg-gray-50 p-4 text-gray-800'
    }
    role="alert"
  >
    <h3 className="text-sm font-medium">{header}</h3>
    <div className="mt-2 text-sm">{children}</div>
  </div>
);
