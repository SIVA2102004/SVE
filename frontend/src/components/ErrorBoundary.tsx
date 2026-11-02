import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  private handleReload = () => {
    // Clear potentially corrupted cache and reload cleanly
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-900 text-white font-sans">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700/80 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">Something went wrong</h2>
              <p className="text-xs text-slate-400 mt-1">
                The application encountered an unexpected glitch. Your records and data are safe in the database.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-slate-900/60 rounded-xl text-left border border-slate-700/50">
                <p className="text-[11px] font-mono text-rose-300 break-words line-clamp-3">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh & Reload</span>
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl text-xs transition-all"
              >
                <Home className="w-4 h-4" />
                <span>Go to Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
