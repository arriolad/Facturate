import {createRoot} from 'react-dom/client';
import './demo-api';
import Home from './Home';
import {SupabaseAuth} from './auth/SupabaseAuth';
import './styles.css';

createRoot(document.getElementById('root')!).render(<SupabaseAuth>{onSignOut=><Home onSignOut={onSignOut}/>}</SupabaseAuth>);
