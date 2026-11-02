import React, { createContext, useContext, useState, useEffect } from 'react';

export type FinancialScope = 'OVERALL' | 'PERSONAL' | 'FAMILY' | 'BUSINESS';

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
    const saved = localStorage.getItem(SCOPE_STORAGE_KEY) as FinancialScope;
    return saved && ['OVERALL', 'PERSONAL', 'FAMILY', 'BUSINESS'].includes(saved)
      ? saved
      : 'OVERALL';
  });

  const setScope = (newScope: FinancialScope) => {
    setScopeState(newScope);
    localStorage.setItem(SCOPE_STORAGE_KEY, newScope);
  };

  useEffect(() => {
    const saved = localStorage.getItem(SCOPE_STORAGE_KEY) as FinancialScope;
    if (saved && saved !== scope) {
      setScopeState(saved);
    }
  }, []);

  const scopeLabels: Record<FinancialScope, string> = {
    OVERALL: 'Consolidated (All)',
    PERSONAL: 'Personal Finance',
    FAMILY: 'Family Finance',
    BUSINESS: 'Sri Venkateswara Enterprises',
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
