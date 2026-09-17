import {createRoot} from 'react-dom/client';
import {Root} from './root-context';
import Observatory from './observatory';
import './globals.css';
createRoot(document.getElementById('root')!).render(<Root><Observatory/></Root>);
