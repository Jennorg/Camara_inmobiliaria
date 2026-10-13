# Reglas del Proyecto - Cámara Inmobiliaria

## Estándar de Inputs de Búsqueda (CRÍTICO)

En cualquier vista, panel, modal o sección del proyecto donde se cree o modifique un campo de búsqueda de personas, afiliados, participantes o registros:

1. **Selector de Criterio Obligatorio:**
   El input de búsqueda DEBE incluir siempre un dropdown integrado a la izquierda para seleccionar el criterio de búsqueda (ej. `Nombre`, `Cédula`, `Correo`, etc., según corresponda a la entidad).

2. **Formato Visual Estándar:**
   - Contenedor con fondo suave (`bg-slate-50`), borde (`border border-slate-200/80 rounded-xl`), y foco dinámico (`focus-within:ring-2 focus-within:ring-emerald-500/10 focus-within:border-emerald-500`).
   - Botón de criterio a la izquierda con texto en mayúscula (`text-[9px]` o `text-[10px] font-black uppercase tracking-wider text-slate-600`), icono `ChevronDown`, y menú desplegable flotante con `fixed inset-0` para cerrar al hacer clic afuera.
   - Icono `Search` dentro del campo de texto.
   - Placeholder contextual que indique el criterio seleccionado (ej. `Buscar por nombre o empresa...`, `Buscar por cédula de identidad...`, `Buscar por correo electrónico...`).
   - Botón de limpiar búsqueda (`X`) visible cuando el campo contenga texto.

3. **Soporte en Backend / API:**
   - Al enviar el término de búsqueda al backend, incluir siempre el parámetro `searchField` (o filtrar en cliente según el criterio activo).
   - El endpoint o consulta SQL debe condicionar la cláusula `WHERE` según el campo elegido (`nombre`, `cedula`, `email`), además de mantener la opción general/todos como respaldo.
