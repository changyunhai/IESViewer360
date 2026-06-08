import React, { Suspense } from 'react';
import logo from './logo.svg';
import './App.css';
import PageParserMain from './pages/page_parser_main';
import PageSimulatorMain from './pages/page_simulator_main';

//const PageParserMain = React.lazy(() => import('./pages/page_parser_main'));
//const PageSimulatorMain = React.lazy(() => import('./pages/page_simulator_main'));

const titles: any = { parser: 'IES file parser', simulator: 'IES light simulator' }

function App() {
  document.title = titles[process.env.REACT_APP_NAME!];

  return (
    <div className="App">
      <Suspense fallback={<div>Loading...</div>}>
        {
          process.env.REACT_APP_NAME == 'parser' ? <PageParserMain /> : <PageSimulatorMain />
        }
      </Suspense>
    </div>
  );
}

export default App;
