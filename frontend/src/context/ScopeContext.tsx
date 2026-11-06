import React, { createContext, useContext, useState, useEffect } from 'react';

export type FinancialScope = 'OVERALL' | 'PERSONAL' | 'BUSINESS';

interface ScopeContextType {
  scope: FinancialScope;
  setScope: (scope: FinancialScope) => void;
  scopeLabel: string;
}

const ScopeContext = createContext<ScopeContextType>({
  scope: 'OVERALL',
  setScope: () => {},
  scopeLabel: 'Overall Financials',
});

const SCOPE_STORAGE_KEY = 'sve_financial_scope';

export const ScopeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [scope, setScopeState] = useState<FinancialScope>(() => {
    const saved = localStorage.getItem(SCOPE_STORAGE_KEY) as string;
    if (saved === 'FAMILY') return 'PERSONAL';
    return saved && ['OVERALL', 'PERSONAL', 'BUSINESS'].includes(saved)
      ? (saved as FinancialScope)
      : 'OVERALL';
  });

  const setScope = (newScope: FinancialScope) => {
    setScopeState(newScope);
    localStorage.setItem(SCOPE_STORAGE_KEY, newScope);
  };

  useEffect(() => {
    const saved = localStorage.getItem(SCOPE_STORAGE_KEY) as string;
    if (saved === 'FAMILY') {
      setScopeState('PERSONAL');
      localStorage.setItem(SCOPE_STORAGE_KEY, 'PERSONAL');
    } else if (saved && saved !== scope && ['OVERALL', 'PERSONAL', 'BUSINESS'].includes(saved)) {
      setScopeState(saved as FinancialScope);
    }
  }, []);

  const scopeLabels: Record<FinancialScope, string> = {
    OVERALL: 'Consolidated (All)',
    PERSONAL: 'Personal & Family',
    BUSINESS: 'Sri Venkateswara Enterprises (Business)',
  };

  return (
    <ScopeContext.Provider
      value={{
        scope,
        setScope,
        scopeLabel: scopeLabels[scope],
      }}
    >
      {children}
    </ScopeContext.Provider>
  );
};

export const useScope = () => useContext(ScopeContext);
