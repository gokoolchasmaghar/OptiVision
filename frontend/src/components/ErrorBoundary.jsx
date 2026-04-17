import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unknown error' };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled UI error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900 mb-2">Something went wrong</h1>
          <p className="text-sm text-slate-600 mb-4">
            The app hit an unexpected error. Refresh and try again.
          </p>
          <pre className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 overflow-x-auto">
            {this.state.message}
          </pre>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-4 btn-primary btn-md"
          >
            Reload App
          </button>
        </div>
      </div>
    );
  }
}
