import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
class ErrorBoundary extends React.Component<{children:React.ReactNode},{error:string}>{state={error:''};static getDerivedStateFromError(error:Error){return{error:error.message};}render(){if(this.state.error)return <main style={{padding:40,fontFamily:'system-ui'}}><h1>DiagramCloud could not open this view</h1><p>Your saved IndexedDB workspace has not been deleted. Reload the page; preserve a backup before clearing site data.</p><pre>{this.state.error}</pre><button onClick={()=>location.reload()}>Reload</button></main>;return this.props.children;}}
ReactDOM.createRoot(document.getElementById('root')!).render(<ErrorBoundary><App/></ErrorBoundary>);
