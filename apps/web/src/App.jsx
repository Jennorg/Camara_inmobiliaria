
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Cursos from './pages/Formacion/Talleres';
import Home from './features/landing/Home';

//Pages
import MisionVision from './pages/MisionVision/MisionVision';
import JuntaDirectiva from './pages/Juntadirectiva/JuntaDirectiva';
import Historia from './pages/Historia/Historia';
import CIV from './pages/CIV/Civ'
import Direccion from './pages/Direccion/Direccion';

export default function LandingBolivar() {

  return (
    <BrowserRouter basename="/Camara_inmobiliaria" >
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cursos" element={<Cursos />} />
        <Route path="/talleres" element={<Cursos />} />
        <Route path='/mision_vision' element={<MisionVision />} />
        <Route path='/junta_directiva' element={<JuntaDirectiva />} />
        <Route path='/historia' element={<Historia />} />
        <Route path='/codigo_etica' element={<CIV />} />
        <Route path='/direccion' element={<Direccion />} />
      </Routes>
    </BrowserRouter>
  );
}