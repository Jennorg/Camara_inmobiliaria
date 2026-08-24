import { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { API_URL } from '@/config/env';
import { apiFetch } from '@/lib/apiClient';
import { AfiliadoData } from '../AfiliadoCard';
import logoCibir from '@/assets/Logo3.webp';

interface AfiliadoProfile extends AfiliadoData {
  afiliados_asociados?: AfiliadoData[];
}

export interface UseAfiliadoProfileResult {
  afiliado: AfiliadoProfile | null;
  loading: boolean;
  error: string | null;
  isRepMode: boolean;
  isCorporativo: boolean;
  yearsOfService: number;
  hasOrganigram: boolean;
  leaderNode: AfiliadoProfile;
  childrenNodes: AfiliadoProfile[];
  companyLogo: string | null;
  displayEmblem: string;
  showEmpresaSection: boolean;
  showAfiliadoSection: boolean;
  ubicacionTexto: string;
}

export const useAfiliadoProfile = (): UseAfiliadoProfileResult => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [afiliado, setAfiliado] = useState<AfiliadoProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchProfile = async () => {
      try {
        if (!id) return;
        const json = await apiFetch(`${API_URL}/api/public/afiliados/${encodeURIComponent(id)}`);
        if (!active) return;
        if (json.success) {
          setAfiliado(json.data);
        } else {
          setError(json.message || 'No se pudo cargar el perfil');
        }
      } catch (err) {
        if (!active) return;
        console.error('Error fetching profile:', err);
        setError('Error de conexión con el servidor');
      } finally {
        if (active) setLoading(false);
      }
    };

    if (id) fetchProfile();
    return () => { active = false; };
  }, [id]);

  const isRepMode = useMemo(() =>
    new URLSearchParams(location.search).get('mode') === 'rep',
    [location.search]);

  const derived = useMemo(() => {
    if (!afiliado) {
      return {
        isCorporativo: false,
        yearsOfService: 0,
        hasOrganigram: false,
        leaderNode: {} as AfiliadoProfile,
        childrenNodes: [],
        companyLogo: null,
        displayEmblem: logoCibir,
        showEmpresaSection: false,
        showAfiliadoSection: false,
        ubicacionTexto: '',
      };
    }

    const isCorporativo = afiliado.tipo_afiliado === 'Corporativo' && !isRepMode;
    const yearsOfService = afiliado.fecha_inicio_servicio
      ? new Date().getFullYear() - new Date(afiliado.fecha_inicio_servicio).getFullYear()
      : 0;

    const hasOrganigram = (isCorporativo && afiliado.afiliados_asociados && afiliado.afiliados_asociados.length > 0) ||
      (!isCorporativo && afiliado.id_empresa && afiliado.afiliados_asociados && afiliado.afiliados_asociados.length > 0);

    const leaderNode = isCorporativo
      ? afiliado
      : (afiliado.afiliados_asociados || []).find(a => a.tipo_afiliado === 'Corporativo') || afiliado;

    const childrenNodes = (afiliado.afiliados_asociados || []).filter(
      (assoc) => assoc.id_afiliado !== leaderNode.id_afiliado
    );

    const companyLogo = afiliado.empresa_logo_url || null;
    const displayEmblem = (isCorporativo && companyLogo) ? companyLogo : logoCibir;

    const showEmpresaSection =
      (isCorporativo ||
       (afiliado.tipo_afiliado !== 'Natural' && 
        (!!(afiliado.empresa_razon_social || afiliado.razon_social) || !!afiliado.id_empresa)));
    const showAfiliadoSection = !isCorporativo || isRepMode;

    const ubicacionTexto = isCorporativo || (afiliado as any).mostrar_direccion_publica
      ? (afiliado.direccion_publica || afiliado.direccion || 'Ciudad Guayana, Bolívar')
      : (afiliado.direccion_publica || afiliado.direccion || 'Información reservada');

    return {
      isCorporativo,
      yearsOfService,
      hasOrganigram,
      leaderNode,
      childrenNodes,
      companyLogo,
      displayEmblem,
      showEmpresaSection,
      showAfiliadoSection,
      ubicacionTexto,
    };
  }, [afiliado, isRepMode]);

  return {
    afiliado,
    loading,
    error,
    isRepMode,
    ...derived
  } as UseAfiliadoProfileResult;
};
