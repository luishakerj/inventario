
// Escapar HTML para prevenir inyección de código al renderizar datos en innerHTML
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Auto-categorizar productos basándose en el nombre
function autoCategorizarProducto(product) {
    const name = String(product.name || '').trim().toLowerCase();
    const category = String(product.category || '').trim();

    // Si el nombre empieza con "ácido" o "acido", debe ser "Acido"
    if (/^á?cido/.test(name)) {
        return 'Acido';
    }

    // Si el nombre contiene solventes típicos, debe ser "Solventes"
    const solventKeywords = ['alcohol', 'butanol', 'acetona', 'hexano', 'cloroformo', 'etanol', 'metanol', 'bencina', 'tolueno', 'xileno'];
    if (solventKeywords.some(keyword => name.includes(keyword))) {
        return 'Solventes';
    }

    // Si ya tiene categoría válida, mantenerla
    return category || 'Otros';
}

function normalizeCategory(category) {
    return String(category || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function categoryHasNoDates(category) {
    const normalized = normalizeCategory(category);
    return normalized === 'equipos' ||
        normalized.includes('materiales') ||
        normalized === 'articulos de oficina' ||
        normalized === 'otros';
}

function categoryHasNoMetadata(category) {
    const normalized = normalizeCategory(category);
    return /^articulos? de oficina$/.test(normalized);
}

function isLaboratoryMaterials(category) {
    return normalizeCategory(category) === 'materiales de laboratorio';
}

// Mostrar notificación flotante de éxito/error
function showToast(mensaje, tipo = 'success') {
    const container = document.getElementById('toast-container') || (() => {
        const c = document.createElement('div');
        c.id = 'toast-container';
        document.body.appendChild(c);
        return c;
    })();

    const toast = document.createElement('div');
    toast.className = `toast-message toast-${tipo}`;
    const icono = tipo === 'success' ? 'ph-check-circle' : tipo === 'error' ? 'ph-x-circle' : 'ph-warning-circle';
    toast.innerHTML = `<i class="ph ${icono}"></i><span>${escapeHtml(mensaje)}</span>`;

    container.appendChild(toast);

    // Animación de entrada
    requestAnimationFrame(() => toast.classList.add('visible'));

    // Desaparecer después de 3 segundos
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

function isEquipment(category) {
    return normalizeCategory(category) === 'equipos';
}

function isCleaningMaterials(category) {
    const normalized = normalizeCategory(category);
    return normalized === 'materiales de limpieza' ||
        normalized === 'articulos de limpieza';
}

function isSolvent(category) {
    return normalizeCategory(category) === 'solventes';
}

function isAcid(category) {
    return normalizeCategory(category) === 'acido';
}

function isBase(category) {
    return normalizeCategory(category) === 'bases y sales';
}

function isOther(category) {
    return normalizeCategory(category) === 'otros' || normalizeCategory(category) === 'otro';
}

function isMarca(category) {
    return normalizeCategory(category) === 'marca';
}

function isReagent(category) {
    return ['solventes', 'acido', 'bases y sales', 'polimeros', 'congelados y refrigerador', 'congelados y refrigerados'].includes(normalizeCategory(category));
}

function normalizeQuantityUnit(unit) {
    const value = String(unit || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const match = value.match(/^(\d+(?:[.,]\d+)?)\s*(ML|L|MG|G|KG|U)$/);
    if (!match) return value;

    const amount = match[1].replace(',', '.');
    return `${amount} ${match[2]}`;
}

function formatQuantityUnit(product) {
    const quantity = product.stock ?? 0;
    const unit = normalizeQuantityUnit(product.unit);
    if (isEquipment(product.category) || categoryHasNoMetadata(product.category)) {
        return `${quantity} / ${unit || '-'}`;
    }
    return isReagent(product.category)
        ? `${quantity} / ${unit || 'UND'}`
        : `${quantity} ${unit}`.trim();
}

// Gestor del estado de la aplicación

const app = {

    products: [],
    activities: [],
    trash: [],
    defaultProducts: [
        { nombre: "Ejemplo 1", categoria: "General", cantidad: 10, marca: "Genérica", lote: "001" }
    ],
    // Agrega esto dentro de tu objeto 'app' o al inicio de tu script
    verificarDatosIniciales() {
        // Revisa si ya existen reportes o inventario en el localStorage de tu amigo
        const reportesGuardados = localStorage.getItem('inventario_reportes');

        // Si no hay nada guardado (es la primera vez que abre la app)
        if (!reportesGuardados || JSON.parse(reportesGuardados).length === 0) {
            const datosPrueba = [
                {
                    id: Date.now(),
                    fecha: new Date().toLocaleString('es-ES'),
                    tipo: 'reporte',
                    tipoTexto: 'Registro Inicial',
                    nombre: 'Muestra de laboratorio de prueba',
                    cantidad: 25,
                    categoria: 'General',
                    lote: 'LOTE-001',
                    detalle: 'Carga automática inicial para vista previa'
                }
            ];

            // Guarda los datos de prueba en el localStorage
            localStorage.setItem('inventario_reportes', JSON.stringify(datosPrueba));
        }
    },

    toggleOpcionesMenu() {
        const menu = document.getElementById('menu-opciones-flotante');
        if (menu) {
            menu.classList.toggle('oculto');
        }
    },


    abrirModalHistorial() {
        this.openModal('modal-historial-reportes');
        this.renderizarHistorial();
    },

    abrirModalReportes() {
        this.openModal('reporte-generar');
    },

    renderReportHistory(filtro = 'todos') {
        this.renderizarHistorial();
    },

    registrarEnHistorial(item) {
        let historial = [];
        try {
            historial = JSON.parse(localStorage.getItem('inventario_reportes')) || [];
            if (!Array.isArray(historial)) historial = [];
        } catch (e) {
            historial = [];
        }

        const nuevoItem = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            fecha: item.fecha || new Date().toLocaleString('es-ES'),
            tipo: item.tipo || 'reporte', // 'nuevo_producto', 'reporte', 'edicion'
            tipoTexto: item.tipoTexto || (item.tipo === 'nuevo_producto' ? 'Nuevo Producto' : item.tipo === 'edicion' ? 'Producto Editado' : 'Reporte'),
            nombre: item.nombre || 'Sin nombre',
            cantidad: (item.cantidad !== undefined && item.cantidad !== null && String(item.cantidad).trim() !== '') ? item.cantidad : '1',
            categoria: item.categoria || '-',
            lote: item.lote || '-',
            detalle: item.detalle || '-'
        };

        historial.unshift(nuevoItem);
        localStorage.setItem('inventario_reportes', JSON.stringify(historial));
        return nuevoItem;
    },

    renderizarHistorial() {
        const tbody = document.getElementById('tabla-historial-cuerpo');
        if (!tbody) return;

        let reportes = [];
        try {
            reportes = JSON.parse(localStorage.getItem('inventario_reportes')) || [];
            if (!Array.isArray(reportes)) reportes = [];
        } catch (e) {
            reportes = [];
        }

        // Filtro por tipo
        const tipoSelect = document.getElementById('filtro-historial-tipo');
        const tipoFiltro = tipoSelect ? tipoSelect.value : 'todos';

        // Filtro por texto de búsqueda en historial
        const buscarInput = document.getElementById('filtro-historial-buscar');
        const rawBuscar = buscarInput ? buscarInput.value : '';
        const buscarQuery = String(rawBuscar || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

        tbody.innerHTML = '';

        const reportesFiltrados = reportes.filter(rep => {
            // Filtrar por tipo
            if (tipoFiltro !== 'todos') {
                if (tipoFiltro === 'nuevo_producto') {
                    if (rep.tipo !== 'nuevo_producto' && rep.tipo !== 'entrada') return false;
                } else if (tipoFiltro === 'reporte') {
                    if (rep.tipo !== 'reporte' && rep.tipo !== 'salida') return false;
                } else if (tipoFiltro === 'edicion') {
                    if (rep.tipo !== 'edicion') return false;
                } else if (rep.tipo !== tipoFiltro) {
                    return false;
                }
            }

            // Filtrar por texto
            if (buscarQuery) {
                const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const matchNombre = norm(rep.nombre).includes(buscarQuery);
                const matchTipo = norm(rep.tipoTexto || rep.tipo).includes(buscarQuery);
                const matchCat = norm(rep.categoria).includes(buscarQuery);
                const matchLote = norm(rep.lote).includes(buscarQuery);
                const matchDetalle = norm(rep.detalle).includes(buscarQuery);
                const matchFecha = norm(rep.fecha).includes(buscarQuery);
                if (!matchNombre && !matchTipo && !matchCat && !matchLote && !matchDetalle && !matchFecha) {
                    return false;
                }
            }

            return true;
        });



        // Actualizar contador
        const conteoEl = document.getElementById('historial-conteo');
        if (conteoEl) {
            conteoEl.textContent = `Mostrando ${reportesFiltrados.length} de ${reportes.length} registro(s)`;
        }

        if (reportesFiltrados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2.5rem; color: #94a3b8; font-size: 0.95rem;">No hay registros en el historial.</td></tr>`;
            return;
        }

        reportesFiltrados.forEach(rep => {
            const esNuevo = rep.tipo === 'nuevo_producto' || rep.tipo === 'entrada';
            const esEdicion = rep.tipo === 'edicion';

            let badgeBg = 'rgba(56, 189, 248, 0.18)';
            let badgeColor = '#38bdf8';
            let badgeBorder = 'rgba(56, 189, 248, 0.35)';
            let badgeText = rep.tipoTexto || 'REPORTE';

            if (esNuevo) {
                badgeBg = 'rgba(16, 185, 129, 0.18)';
                badgeColor = '#10b981';
                badgeBorder = 'rgba(16, 185, 129, 0.35)';
                badgeText = rep.tipoTexto || 'NUEVO PRODUCTO';
            } else if (esEdicion) {
                badgeBg = 'rgba(245, 158, 11, 0.18)';
                badgeColor = '#f59e0b';
                badgeBorder = 'rgba(245, 158, 11, 0.35)';
                badgeText = rep.tipoTexto || 'EDITADO';
            }

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #1e293b';
            tr.style.transition = 'background 0.2s ease';
            tr.onmouseenter = () => tr.style.background = 'rgba(255, 255, 255, 0.03)';
            tr.onmouseleave = () => tr.style.background = 'transparent';

            tr.innerHTML = `
        <td style="padding: 0.75rem; font-weight: 500; color: #f8fafc;">${escapeHtml(rep.nombre || '-')}</td>
        <td style="padding: 0.75rem; color: #e2e8f0; font-weight: 500;">${escapeHtml(rep.categoria || '-')}</td>
        <td class="quantity-column" style="padding: 0.75rem; color: #e2e8f0; width: 100px; max-width: 100px;">${rep.cantidad !== undefined ? escapeHtml(rep.cantidad) : '-'}</td>
        <td class="marca-column" style="padding: 0.75rem; color: #94a3b8; width: 120px; max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(rep.marca || '-')}</td>
        <td style="padding: 0.75rem; color: #94a3b8; font-family: monospace; font-size: 0.85rem;">${escapeHtml(rep.lote || '-')}</td>
        <td style="padding: 0.75rem; color: #94a3b8; font-size: 0.85rem;">${escapeHtml(rep.fechaProd || '-')}</td>
        <td style="padding: 0.75rem; color: #94a3b8; font-size: 0.85rem;">${escapeHtml(rep.fechaVenc || '-')}</td>
        <td style="padding: 0.75rem; color: #64748b; font-size: 0.85rem;">${escapeHtml(rep.detalle || '-')}</td>
        <td style="padding: 0.75rem; text-align: right;">
            <span style="color: ${badgeColor}; font-weight: 600; background: ${badgeBg}; border: 1px solid ${badgeBorder}; padding: 3px 10px; border-radius: 4px; font-size: 0.75rem;">
                ${escapeHtml(badgeText)}
            </span>
        </td>
    `;
            tbody.appendChild(tr);
        });
    },

    limpiarHistorial() {
        if (confirm('¿Estás seguro de que deseas vaciar todo el historial de reportes y movimientos?')) {
            localStorage.removeItem('inventario_reportes');
            this.renderizarHistorial();
        }
    },

    registrarMovimiento(producto, tipo) {
        return this.registrarEnHistorial({
            tipo: tipo,
            tipoTexto: tipo === 'entrada' ? 'Nuevo Producto' : 'Salida',
            nombre: producto.nombre || producto.name || 'Sin nombre',
            cantidad: producto.cantidad || producto.stock || '1',
            categoria: producto.categoria || producto.category || '-',
            lote: producto.lote || producto.codigo || '-',
            detalle: 'Movimiento registrado'
        });
    },
    // ==========================================

    init() {
        // Cargar productos de localStorage...
        // Cargar productos de localStorage si ya existen Y tienen datos
        const saved = localStorage.getItem('cirna_inventory');
        let loaded = false;
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const hasCorruptedOthers = Array.isArray(parsed) && parsed.some(product => {
                    const category = normalizeCategory(product?.category || product?.categoria);
                    const name = String(product?.name || product?.nombre || '').trim();
                    return category === 'otros' && /^(?:\d[\d\-]*|\d+[.,]?\d*)$/.test(name.replace(/\s+/g, ''));
                });

                if (Array.isArray(parsed) && parsed.length > 0 && !hasCorruptedOthers) {
                    let updated = false;
                    this.products = parsed.map(product => {
                        let p = {
                            ...product,
                            unit: normalizeQuantityUnit(product.unit)
                        };
                        if (p.id === 190 && (p.name === 'Alcohol etilico' || (p.lote && p.lote.length > 20))) {
                            p.name = 'Alcohol metílico';
                            p.lote = '-';
                            updated = true;
                        }
                        return p;
                    });
                    if (updated) {
                        localStorage.setItem('cirna_inventory', JSON.stringify(this.products));
                    }
                    loaded = true;
                }
            } catch (e) {
                loaded = false;
            }
        }

        // Cargar papelera desde localStorage
        const savedTrash = localStorage.getItem('cirna_trash');
        if (savedTrash) {
            try {
                this.trash = JSON.parse(savedTrash);
            } catch (e) {
                this.trash = [];
            }
        }

        const looksLikePlaceholder = Array.isArray(this.products) &&
            this.products.length === 1 &&
            (this.products[0]?.nombre === 'Ejemplo 1' || this.products[0]?.name === 'Ejemplo 1');

        if (!loaded || looksLikePlaceholder) {
            // Usar datos del Excel (la lista `products` viene de data.js)
            if (typeof products !== 'undefined' && products.length > 0) {
                this.products = products;
            } else if (!loaded) {
                this.products = [...(this.defaultProducts || [])];
            }
            try {
                localStorage.setItem('cirna_inventory', JSON.stringify(this.products));
            } catch (e) {
                console.warn('No se pudo guardar el inventario en localStorage', e);
            }
        }

        // Cargar actividades registradas
        const savedActivities = localStorage.getItem('cirna_activities');
        if (savedActivities) {
            try {
                const parsedActivities = JSON.parse(savedActivities);
                this.activities = Array.isArray(parsedActivities) ? parsedActivities : [];
            } catch (e) {
                this.activities = [];
            }
        } else {
            this.activities = [];
            this.logActivity('Sistema inicializado', 'Bienvenido al Inventario LICC');
        }

        // Auto-categorizar productos basándose en el nombre
        this.products = (this.products || []).map(product => ({
            ...product,
            marca: product.marca || product.location || '',
            category: autoCategorizarProducto(product),
            unit: normalizeQuantityUnit(product.unit)
        }));

        // Guardar cambios de categorización
        try {
            localStorage.setItem('cirna_inventory', JSON.stringify(this.products));
        } catch (e) {
            console.warn('No se pudo guardar el inventario en localStorage', e);
        }

        this.renderTables();
        if (typeof cargarFiltroCategorias === 'function') {
            cargarFiltroCategorias(this.products);
        }
        // Mostrar la vista de administración por defecto al iniciar
        this.navigate('view-menu'); // Cambia 'view-menu-admin' por el ID de tu pantalla con el logo

    },

    saveData() {
        localStorage.setItem('cirna_inventory', JSON.stringify(this.products));
        localStorage.setItem('cirna_trash', JSON.stringify(this.trash));
    },

    deleteProduct(id) {
        const index = this.products.findIndex(p => String(p.id) === String(id));
        if (index !== -1) {
            const deletedItem = this.products.splice(index, 1)[0];
            this.trash.push(deletedItem);
            this.saveData();
            this.renderTables();
            this.renderTrashTable();
            showToast(`Se eliminó "${deletedItem.name || deletedItem.nombre || 'el producto'}" con éxito`, 'success');
            this.logActivity(`Producto eliminado: ${deletedItem.name || deletedItem.nombre}`, 'Movido a la papelera de reciclaje');

            // Redirige automáticamente a la papelera al eliminar el objeto
            this.navigate('view-papelera');
        }
    },

    renderTrashTable() {
        const trashBody = document.getElementById('table-body-papelera');
        if (!trashBody) return;

        trashBody.innerHTML = '';

        if (this.trash.length === 0) {
            trashBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">La papelera está vacía</td></tr>`;
            return;
        }

        this.trash.forEach((p, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.name || p.nombre || '-'}</td>
                <td>${p.category || p.categoria || '-'}</td>
                <td>${p.stock || 0}</td>
                <td style="text-align: right;">
                    <button class="btn-icon" onclick="app.restoreProduct(${index})" title="Restaurar"><i class="ph ph-arrow-counter-clockwise"></i></button>
                    <button class="btn-icon" onclick="app.permanentDelete(${index})" title="Eliminar definitivamente" style="color: #ef4444;"><i class="ph ph-x"></i></button>
                </td>
            `;
            trashBody.appendChild(tr);
        });
    },

    restoreProduct(index) {
        const restoredItem = this.trash.splice(index, 1)[0];
        this.products.push(restoredItem);
        this.saveData();
        this.renderTables();
        this.renderTrashTable();
    },

    permanentDelete(index) {
        if (confirm("¿Estás seguro de eliminar este insumo permanentemente?")) {
            const deletedItem = this.trash[index];
            this.trash.splice(index, 1);
            this.saveData();
            this.renderTrashTable();
            showToast(`Se eliminó "${deletedItem?.name || deletedItem?.nombre || 'el producto'}" permanentemente con éxito`, 'success');
        }
    },
    // ---------------------



    // Navegación entre vistas
    navigate(viewId) {
        // Ocultar todas las vistas de forma estricta
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
            v.style.display = 'none';
        });

        // Mostrar la vista solicitada
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.add('active');
            targetView.style.display = 'block';
        }

        // Renderizar los datos actualizados cuando se entra a una vista
        this.renderTables();

        // Si entra a la papelera, actualizar su tabla
        if (viewId === 'view-papelera' && typeof this.renderTrashTable === 'function') {
            this.renderTrashTable();
        }

        document.querySelectorAll('.table-responsive, .scroll-top-mirror').forEach(scrollContainer => {
            scrollContainer.scrollLeft = 0;
        });

        // Limpiar búsquedas al cambiar de vista
        const searchStudent = document.getElementById('search-student');
        if (searchStudent) searchStudent.value = '';
        const searchAdmin = document.getElementById('search-admin');
        if (searchAdmin) searchAdmin.value = '';
    },





    // Renderizar HTML de las tablas
    renderTables(dataToRender = this.products) {
        const studentBody = document.getElementById('table-body-student');
        const adminBody = document.getElementById('table-body-admin');
        const studentTable = document.getElementById('table-student');
        const adminTable = document.getElementById('table-admin');

        if (!studentBody || !adminBody) return;
        if (!Array.isArray(dataToRender)) dataToRender = [];

        studentBody.innerHTML = '';
        adminBody.innerHTML = '';

        const hasDateColumns = dataToRender.some(p => !categoryHasNoDates(p.category));
        const hasMetadataColumns = dataToRender.some(p => !categoryHasNoMetadata(p.category));
        // Lab, limpieza y artículos de limpieza comparten el layout completo de columnas
        const showLabMaterialColumns = dataToRender.length > 0 &&
            dataToRender.every(p => isLaboratoryMaterials(p.category) || isCleaningMaterials(p.category));
        const showEquipmentLayout = dataToRender.length > 0 &&
            dataToRender.every(p => isEquipment(p.category));
        const showCleaningMaterialsLayout = false;
        const showSolventLayout = dataToRender.length > 0 &&
            dataToRender.every(p => isSolvent(p.category));
        const showAcidLayout = dataToRender.length > 0 &&
            dataToRender.every(p => isAcid(p.category));
        const showBaseLayout = dataToRender.length > 0 &&
            dataToRender.every(p => isBase(p.category));
        const hideDescriptionColumn = dataToRender.length > 0 &&
            dataToRender.every(p => isOther(p.category));
        const hideMarcaColumn = dataToRender.length > 0 &&
            dataToRender.every(p => isMarca(p.category));
        const hideMarcaOtros = dataToRender.length > 0 &&
            dataToRender.every(p => isOther(p.category));

        if (studentTable) studentTable.classList.toggle('hide-date-columns', !hasDateColumns);
        if (adminTable) adminTable.classList.toggle('hide-date-columns', !hasDateColumns);
        if (studentTable) studentTable.classList.toggle('hide-other-columns', !hasMetadataColumns);
        if (adminTable) adminTable.classList.toggle('hide-other-columns', !hasMetadataColumns);
        if (studentTable) studentTable.classList.toggle('show-lab-material-columns', showLabMaterialColumns);
        if (adminTable) adminTable.classList.toggle('show-lab-material-columns', showLabMaterialColumns);
        if (studentTable) studentTable.classList.toggle('show-equipment-state', showEquipmentLayout);
        if (adminTable) adminTable.classList.toggle('show-equipment-state', showEquipmentLayout);
        if (studentTable) studentTable.classList.toggle('show-cleaning-materials-layout', showCleaningMaterialsLayout);
        if (adminTable) adminTable.classList.toggle('show-cleaning-materials-layout', showCleaningMaterialsLayout);
        if (studentTable) studentTable.classList.toggle('show-solvent-layout', showSolventLayout);
        if (adminTable) adminTable.classList.toggle('show-solvent-layout', showSolventLayout);
        if (studentTable) studentTable.classList.toggle('show-acid-layout', showAcidLayout);
        if (adminTable) adminTable.classList.toggle('show-acid-layout', showAcidLayout);
        if (studentTable) studentTable.classList.toggle('show-base-layout', showBaseLayout);
        if (adminTable) adminTable.classList.toggle('show-base-layout', showBaseLayout);
        if (studentTable) studentTable.classList.toggle('hide-description-column', hideDescriptionColumn);
        if (adminTable) adminTable.classList.toggle('hide-description-column', hideDescriptionColumn);
        if (studentTable) studentTable.classList.toggle('hide-marca-column', hideMarcaColumn);
        if (adminTable) adminTable.classList.toggle('hide-marca-column', hideMarcaColumn);
        if (studentTable) studentTable.classList.toggle('hide-marca-otros', hideMarcaOtros);
        if (adminTable) adminTable.classList.toggle('hide-marca-otros', hideMarcaOtros);
        document.querySelectorAll('th.quantity-column').forEach(column => {
            column.textContent = 'Cantidad / Unidad';
        });
        document.querySelectorAll('th.lote-column, .lot-column').forEach(column => {
            if (column.tagName === 'TH') {
                column.textContent = showLabMaterialColumns ? 'Medidas/Volumen' : column.classList.contains('lote-column') && column.closest('#table-admin')
                    ? 'Lote / Código'
                    : 'Lote';
            }
        });

        if (dataToRender.length === 0) {
            const emptyCols = (hasDateColumns ? 9 : 7) - (hasMetadataColumns ? 0 : 3);
            const emptyMsg = `<tr><td colspan="${emptyCols}" class="text-center" style="padding: 2rem; color: var(--text-muted);">No se encontraron productos.</td></tr>`;
            studentBody.innerHTML = emptyMsg;
            adminBody.innerHTML = emptyMsg;
            return;
        }

        dataToRender.forEach(p => {
            const nombreItem = p.name || p.nombre || '-';
            const categoriaItem = p.category || p.categoria || '-';
            const cantidadItem = p.cantidad !== undefined ? p.cantidad : (p.stock !== undefined ? p.stock : '-');
            const marcaItem = p.marca || p.brand || p.fabricante || '-';
            const loteItem = p.lote || p.codigo || p.location || '-';
            const prodDateItem = p.prodDate || p.fechaProd || '-';
            const expDateItem = p.expDate || p.fechaVenc || '-';
            const descItem = p.desc || p.descripcion || '-';

            const noDateCategory = categoryHasNoDates(p.category);
            const noMetadataCategory = categoryHasNoMetadata(p.category);
            const otherCategory = normalizeCategory(p.category) === 'otros' || normalizeCategory(p.category) === 'otro';
            const equipment = isEquipment(p.category);
            const solvent = isSolvent(p.category);
            const acid = isAcid(p.category);
            const hideLocation = otherCategory || noMetadataCategory || equipment;
            const hideDescription = otherCategory || noMetadataCategory || equipment;



            const prodCell = `<td class="prod-column">${noDateCategory ? '-' : escapeHtml(prodDateItem)}</td>`;
            const expCell = `<td class="exp-column">${noDateCategory ? '-' : escapeHtml(expDateItem)}</td>`;
            const marcaReal = p.marca || p.brand || p.fabricante || p.location || '-';
            const loteReal = p.lote || p.codigo || '-';

            const stockVal = p.stock !== undefined ? p.stock : '-';
            const stockClass = (Number(stockVal) > 0) ? 'stock-ok' : 'stock-low';
            const quantityLabel = formatQuantityUnit(p);

            const isEquipRow = equipment || p.category === 'Equipos' || p.categoria === 'Equipos';
            const rowClass = isEquipRow ? 'equipment-product-row' : '';

            const brandVal = marcaReal;
            const loteVal = loteReal;
            const descVal = p.desc || p.descripcion || '-';

            const commonCells = `
        <td class="name-column">${escapeHtml(p.name || p.nombre || '-')}</td>
        <td class="category-column">${escapeHtml(p.category || p.categoria || '-')}</td>
        <td class="quantity-column"><span class="stock-badge ${stockClass}">${escapeHtml(quantityLabel)}</span></td>
        <td class="marca-column">${escapeHtml(brandVal)}</td>
        <td class="lote-column">${escapeHtml(loteVal)}</td>
        ${prodCell}
        ${expCell}
        <td class="desc-column">${escapeHtml(descVal)}</td>
    `;


            const trStudent = document.createElement('tr');
            trStudent.setAttribute('class', rowClass);
            trStudent.innerHTML = `
        ${commonCells}
        <td class="action-buttons text-right">
            <button class="btn-icon" onclick="app.viewProduct(${p.id})">
                <i class="ph ph-eye"></i>
            </button>
        </td>
    `;
            studentBody.appendChild(trStudent);

            const trAdmin = document.createElement('tr');
            trAdmin.setAttribute('class', rowClass);
            trAdmin.innerHTML = `
        ${commonCells}
        <td class="action-buttons text-right">
            <button class="btn-icon" onclick="app.viewProduct(${p.id})" title="Ver"><i class="ph ph-eye"></i></button>
            <button class="btn-icon" onclick="app.editProduct(${p.id})" title="Editar"><i class="ph ph-pencil"></i></button>
            <button class="btn-icon text-danger" onclick="app.deleteProduct(${p.id})" title="Eliminar"><i class="ph ph-trash"></i></button>
        </td>
    `;

            adminBody.appendChild(trAdmin);
        });
        requestAnimationFrame(() => {
            document.querySelectorAll('.table-responsive, .scroll-top-mirror').forEach(scrollContainer => {
                scrollContainer.scrollLeft = 0;
            });
        });
    },



    filterProducts(viewRole) {
        const inputId = viewRole === 'student' ? 'search-student' : 'search-admin';
        const inputEl = document.getElementById(inputId);
        const rawQuery = inputEl ? inputEl.value : '';

        const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const query = normalize(rawQuery);

        const categorySelect = document.getElementById('category-filter-admin');
        const selectedCat = categorySelect ? categorySelect.value : 'seleccion';
        const hasCategoryFilter = selectedCat && selectedCat !== 'todos' && selectedCat !== 'seleccion';

        const filtered = this.products.filter(p => {
            const pCatNorm = normalize(p.category || p.categoria);

            if (hasCategoryFilter) {
                const normCat = normalize(selectedCat);
                let matchesCat = pCatNorm.includes(normCat) || normCat.includes(pCatNorm);
                if (normCat.includes('congelados') && pCatNorm.includes('congelado')) matchesCat = true;
                if (normCat.includes('acido') && pCatNorm.includes('acido')) matchesCat = true;
                if (!matchesCat) return false;
            }

            // 3. Filtrado por texto de búsqueda general
            if (query) {
                const name = normalize(p.name || p.nombre);
                const category = normalize(p.category || p.categoria);
                const marca = normalize(p.marca || p.location);
                const lote = normalize(p.lote || p.codigo);
                const desc = normalize(p.desc || p.descripcion);
                const unit = normalize(p.unit || p.unidad);

                const matchesText = name.includes(query) ||
                    category.includes(query) ||
                    marca.includes(query) ||
                    lote.includes(query) ||
                    desc.includes(query) ||
                    unit.includes(query);
                if (!matchesText) return false;
            }


            return true;
        });

        this.renderTables(filtered);
    },
    // Modales
    // Abrir modal y cargar reporte si es necesario
    openModal(modalId) {
        let modal = document.getElementById(modalId);
        if (!modal && (modalId === 'reporte-generar' || modalId === 'roporte-generar')) {
            modal = document.getElementById('reporte-generar') || document.getElementById('roporte-generar');
        }
        if (!modal) {
            console.error('Modal no encontrado:', modalId);
            return;
        }
        modal.classList.add('active');

        // Generar reporte automáticamente al abrir el modal de reportes
        //  if (modal.id === 'reporte-generar' || modal.id === 'roporte-generar') {
        //7/    if (typeof this.generateReport === 'function') {
        //    this.generateReport();
        //}

        //}
    },

    closeModal(modalId) {
        let modal = document.getElementById(modalId);
        if (!modal && (modalId === 'reporte-generar' || modalId === 'roporte-g')) {
            modal = document.getElementById('reporte-generar');
        }
        if (modal) {
            modal.classList.remove('active');
        }
        // Reset form if it's the product modal
        if (modalId === 'modal-product') {
            const form = document.getElementById('product-form');
            if (form) form.reset();
            const preview = document.getElementById('image-preview');
            if (preview) preview.style.display = 'none';
            const modalTitle = document.getElementById('modal-title');
            if (modalTitle) modalTitle.innerText = 'Agregar Producto';
        }
    },  // <--- ¡No olvides esta coma!

    // CRUD Operaciones
    handleImageUpload(event) {
        // ...
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                document.getElementById('product-image-data').value = e.target.result;
                const preview = document.getElementById('image-preview');
                const previewImg = document.getElementById('image-preview-img');
                previewImg.src = e.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    },

    saveProduct(e) {
        e.preventDefault();

        const idInput = document.getElementById('product-id')?.value || '';
        const name = document.getElementById('product-name')?.value || '';
        const category = document.getElementById('product-category')?.value || '';
        const stock = parseInt(document.getElementById('product-stock')?.value) || 0;

        const noMetadataCategory = categoryHasNoMetadata(category);
        const laboratoryMaterials = isLaboratoryMaterials(category);
        const equipment = isEquipment(category);

        const location = noMetadataCategory || equipment ? '' : (document.getElementById('product-location')?.value || '');
        const image = document.getElementById('product-image-data')?.value || null;
        const desc = noMetadataCategory || laboratoryMaterials || equipment ? '' : (document.getElementById('product-desc')?.value || '');
        const lote = noMetadataCategory || laboratoryMaterials || equipment ? '' : (document.getElementById('product-lote')?.value || '');
        const noDateCategory = categoryHasNoDates(category);

        const prodDate = noDateCategory ? '' : (document.getElementById('product-prod-date')?.value || '');
        const expDate = noDateCategory ? '' : (document.getElementById('product-exp-date')?.value || '');

        const unitEl = document.getElementById('product-unit');
        const unit = normalizeQuantityUnit(unitEl ? unitEl.value : '');

        const stateEl = document.getElementById('product-state');
        const state = equipment && stateEl ? stateEl.value : '';

        if (idInput) {
            // Editar existente
            const id = parseInt(idInput);
            const index = this.products.findIndex(p => String(p.id) === String(id));
            if (index !== -1) {
                this.products[index] = { id, name, category, stock, location, marca: location, image, desc, lote, prodDate, expDate, unit, state };
                this.logActivity(`Producto editado: ${name} `, `Categoría: ${category}, Stock: ${stock} `);
                this.registrarEnHistorial({
                    tipo: 'edicion',
                    tipoTexto: 'Producto Editado',
                    nombre: name,
                    cantidad: unit ? `${stock} ${unit} ` : `${stock} `,
                    categoria: category,
                    lote: lote || '-',
                    detalle: desc || 'Producto editado en el inventario'
                });
            }
        } else {
            // Crear nuevo
            const newId = this.products.length > 0 ? Math.max(...this.products.map(p => p.id)) + 1 : 1;
            const nuevoProducto = { id: newId, name, category, stock, location, marca: location, image, desc, lote, prodDate, expDate, unit, state };
            this.products.push(nuevoProducto);
            this.logActivity(`Producto creado: ${name} `, `Categoría: ${category}, Stock: ${stock} `);
            this.registrarEnHistorial({
                tipo: 'nuevo_producto',
                tipoTexto: 'Nuevo Producto',
                nombre: name,
                cantidad: unit ? `${stock} ${unit} ` : `${stock} `,
                categoria: category,
                lote: lote || '-',
                detalle: desc || (location ? `Marca: ${location} ` : 'Nuevo producto registrado en inventario')
            });
        }

        this.saveData();
        this.renderTables();
        this.closeModal('modal-product');
    },

    editProduct(id) {
        const product = this.products.find(p => String(p.id) === String(id));
        if (!product) return;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };

        setVal('product-id', product.id);
        setVal('product-name', product.name);
        setVal('product-category', product.category);
        setVal('product-stock', product.stock);
        setVal('product-location', product.marca || product.location);
        setVal('product-desc', product.desc || '');
        setVal('product-lote', product.lote || '');
        setVal('product-prod-date', product.prodDate || '');
        setVal('product-exp-date', product.expDate || '');
        setVal('product-unit', product.unit || 'u');
        setVal('product-state', product.state || 'Operativo');

        if (typeof toggleDateFields === 'function') toggleDateFields();
        if (typeof toggleEquipmentFields === 'function') toggleEquipmentFields();

        // Manejar imagen en edición
        const imgData = document.getElementById('product-image-data');
        if (imgData) imgData.value = product.image || '';

        const previewImg = document.getElementById('image-preview-img');
        const previewDiv = document.getElementById('image-preview');
        const productImg = document.getElementById('product-image');

        if (product.image) {
            if (previewImg) previewImg.src = product.image;
            if (previewDiv) previewDiv.style.display = 'block';
        } else {
            if (previewDiv) previewDiv.style.display = 'none';
            if (productImg) productImg.value = '';
        }

        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) modalTitle.innerText = 'Editar Producto';

        this.openModal('modal-product');
    },
    viewProduct(id) {
        const p = this.products.find(p => String(p.id) === String(id));
        if (!p) return;

        const detailsContainer = document.getElementById('view-product-details');
        const noDateCategory = categoryHasNoDates(p.category);
        const equipment = isEquipment(p.category);
        const cleaningMaterials = isCleaningMaterials(p.category);

        const prodHtml = noDateCategory ? '' : `
        <div class="detail-item">
            <span class="label">F. Producción</span>
            <span class="value">${escapeHtml(p.prodDate || '-')}</span>
        </div>`;

        const expHtml = noDateCategory ? '' : `
        <div class="detail-item">
            <span class="label">F. Vencimiento</span>
            <span class="value">${escapeHtml(p.expDate || '-')}</span>
        </div>`;

        const imageHtml = p.image

            ? `<div style = "grid-column:span 2;text-align:center;margin-bottom:1rem;" >
    <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" style="max-height:200px;border-radius:8px;box-shadow:var(--shadow-soft);">
    </div>`
            : '';

        const equipmentDetailHtml = imageHtml + `
        <div class="detail-item">
            <span class="label">Nombre</span>
            <span class="value">${escapeHtml(p.name || '-')}</span>
        </div>
            <div class="detail-item">
                <span class="label">Categoría</span>
                <span class="value">${escapeHtml(p.category || '-')}</span>
            </div>
            <div class="detail-item">
                <span class="label">Unidad</span>
                <span class="value">${escapeHtml(p.unit || p.unidad || '-')}</span>
            </div>
`;

        detailsContainer.innerHTML = equipment
            ? equipmentDetailHtml
            : imageHtml + `
    <div class="detail-item">
                <span class="label">Nombre</span>
                <span class="value">${escapeHtml(p.name || '-')}</span>
            </div>
    <div class="detail-item">
        <span class="label">Categoría</span>
        <span class="value">${escapeHtml(p.category || '-')}</span>
    </div>
            ${cleaningMaterials ? '' : `<div class="detail-item">
                <span class="label">Cantidad (UND)</span>
                <span class="value">${escapeHtml(p.stock || '0')}</span>
            </div>`}
            ${equipment || cleaningMaterials ? `<div class="detail-item">
                <span class="label">Unidad</span>
                <span class="value">${escapeHtml(p.unit || p.unidad || '-')}</span>
            </div>` : ''
            }
            ${equipment || cleaningMaterials ? '' : `
            <div class="detail-item">
                <span class="label">Marca</span>
                <span class="value">${escapeHtml(p.marca || p.location || '-')}</span>
            </div>
            <div class="detail-item">
                <span class="label">Lote</span>
                <span class="value">${escapeHtml(p.lote || '-')}</span>
            </div>`}
            ${prodHtml}
            ${expHtml}
            ${equipment || cleaningMaterials ? '' : `<div class="detail-item" style="grid-column:span 2;">
                <span class="label">Descripción / Estado</span>
                <span class="value">${escapeHtml(p.desc || '-')}</span>
            </div>`}
            ${equipment ? `<div class="detail-item"><span class="label">Estado</span><span class="value">${escapeHtml(p.state || 'Operativo')}</span></div>` : ''}
`;

        this.openModal('modal-view-product');
    },

    // Registrar actividades
    logActivity(action, details = '') {
        if (!Array.isArray(this.activities)) {
            this.activities = [];
        }
        const timestamp = new Date().toLocaleString('es-ES');
        this.activities.push({
            timestamp,
            action,
            details,
            id: Date.now()
        });
        // Guardar actividades en localStorage
        localStorage.setItem('cirna_activities', JSON.stringify(this.activities));
    },

    // Ver reporte de actividades
    viewActivities() {
        const container = document.getElementById('activities-log');
        if (!container) {
            console.error('Contenedor activities-log no encontrado');
            return;
        }

        if (this.activities.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No hay actividades registradas</p>';
            return;
        }

        container.innerHTML = this.activities.slice().reverse().map(activity => `
    < div style = "background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin-bottom: 10px; border-left: 3px solid var(--primary);" >
                <div style="color: var(--text-main); font-weight: 500; margin-bottom: 4px;">${activity.action}</div>
                <div style="color: var(--text-muted); font-size: 0.85rem;">${activity.timestamp}</div>
                ${activity.details ? `<div style="color: var(--text-muted); font-size: 0.9rem; margin-top: 4px;">${activity.details}</div>` : ''}
            </div >
    `).join('');
    },

    // Generar reporte según los parámetros y guardarlo en el Historial
    generateReport(e) {
        if (e) e.preventDefault();

        const modalReporte = document.getElementById('reporte-generar');
        if (!modalReporte) return;

        const categoryInput = document.getElementById('report-category');
        const nameInput = document.getElementById('report-item-name');
        const dateInput = document.getElementById('report-use-date');
        const qtyInput = document.getElementById('report-quantity-used');

        const categoriaInsumo = categoryInput?.value?.trim() || 'Insumo general';
        const nombreInsumo = nameInput?.value?.trim() || 'Insumo';
        const fechaUsoRaw = dateInput?.value;
        const horaActual = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const fechaUso = fechaUsoRaw ? `${fechaUsoRaw} ${horaActual} ` : new Date().toLocaleString('es-ES');
        const cantidadUso = qtyInput?.value || '1';

        // ============================================
        // DESCUENTO AUTOMÁTICO DE STOCK (consumo)
        // Busca el insumo/reactivo en el inventario y
        // resta la cantidad utilizada de la base de datos.
        // ============================================
        const normalizarTexto = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

        const cantidadNum = parseFloat(String(cantidadUso).replace(',', '.')) || 0;
        const producto = this.products.find(p =>
            normalizarTexto(p.name || p.nombre) === normalizarTexto(nombreInsumo)
        ) || this.products.find(p =>
            normalizarTexto(p.name || p.nombre).includes(normalizarTexto(nombreInsumo))
        );

        let detalleConsumo = 'Reporte de uso registrado (producto no encontrado en inventario)';
        let loteConsumo = '-';
        let stockRestante = null;

        if (producto && cantidadNum > 0) {
            const stockActual = parseFloat(producto.stock) || 0;
            const nuevoStock = Math.max(0, stockActual - cantidadNum);
            producto.stock = Math.round(nuevoStock * 100) / 100;
            stockRestante = producto.stock;
            loteConsumo = producto.lote || producto.codigo || '-';

            this.saveData();
            this.renderTables();

            detalleConsumo = stockActual > 0
                ? `Consumo registrado. Stock anterior: ${stockActual}, descontado: ${cantidadNum}, stock restante: ${producto.stock}${producto.unit ? ' ' + producto.unit : ''}`
                : `Consumo registrado. El stock ya estaba en 0, no se pudo descontar más.`;

            this.logActivity(
                `Consumo de inventario: ${producto.name || producto.nombre}`,
                `Se descontaron ${cantidadNum} del stock. Stock restante: ${producto.stock}`
            );

            // Aviso si el stock quedó en cero o agotado por el consumo
            if (producto.stock <= 0) {
                detalleConsumo += ' ⚠️ ¡El producto se ha AGOTADO!';
            }
        }

        this.registrarEnHistorial({
            tipo: 'reporte',
            tipoTexto: 'Reporte de Uso',
            nombre: nombreInsumo,
            cantidad: cantidadUso,
            categoria: categoriaInsumo,
            lote: loteConsumo,
            detalle: detalleConsumo,
            fecha: fechaUso
        });

        this.logActivity(`Reporte generado: ${nombreInsumo} `, `Cantidad: ${cantidadUso}, Categoría: ${categoriaInsumo} ${stockRestante !== null ? `| Stock restante: ${stockRestante}` : ''} `);

        const resultadoDiv = document.getElementById('report-result');
        if (resultadoDiv) {
            resultadoDiv.innerHTML = `
    < div style = "background: rgba(16, 185, 129, 0.15); padding: 1.2rem; border-radius: 8px; border: 1px solid #10b981; color: #f8fafc; text-align: center; margin-top: 1rem;" >
                    <h3 style="color: #10b981; margin-bottom: 0.4rem; font-size: 1.2rem;">✅ ¡Reporte guardado con éxito!</h3>
                    <p style="margin: 0.2rem 0; color: #cbd5e1; font-size: 0.95rem;">Se registró el uso de <strong>${nombreInsumo}</strong> (Cantidad: ${cantidadUso}).</p>
                    ${stockRestante !== null
                        ? `<p style="margin: 0.2rem 0; color: ${stockRestante <= 0 ? '#ef4444' : '#10b981'}; font-size: 0.95rem;">Stock restante en inventario: <strong>${stockRestante}${producto?.unit ? ' ' + producto.unit : ''}</strong>${stockRestante <= 0 ? ' ⚠️ Producto agotado' : ''}</p>`
                        : `<p style="margin: 0.2rem 0; color: #f59e0b; font-size: 0.85rem;">⚠️ No se encontró el producto en el inventario, solo se registró el reporte.</p>`}
                    <p style="margin: 0.2rem 0; color: #94a3b8; font-size: 0.85rem;">Fecha: ${fechaUso} | Categoría: ${categoriaInsumo}</p>
                    <p style="margin-top: 0.5rem; font-size: 0.85rem; color: #38bdf8;">Ya puedes consultarlo en el botón <strong>"Ver Historial"</strong>.</p>
                </div >
    `;
        }
    },
    // Reporte de Actividades
    generateActivitiesReport(dateFrom, dateTo) {
        if (this.activities.length === 0) {
            return '<p style="color: var(--text-muted); text-align: center;">No hay actividades registradas</p>';
        }

        let filtered = this.activities;

        if (dateFrom || dateTo) {
            const from = dateFrom ? new Date(dateFrom).setHours(0, 0, 0, 0) : 0;
            const to = dateTo ? new Date(dateTo).setHours(23, 59, 59, 999) : Infinity;

            filtered = this.activities.filter(activity => {
                let actTime = activity.id ? Number(activity.id) : null;
                if (!actTime && activity.timestamp) {
                    actTime = Date.parse(activity.timestamp);
                }
                if (!actTime) return true;
                return actTime >= from && actTime <= to;
            });
        }

        if (filtered.length === 0) {
            return '<p style="color: var(--text-muted); text-align: center;">No hay actividades en este período</p>';
        }

        let html = `< div style = "background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;" >
            <h4 style="color: var(--primary); margin-bottom: 10px;">📋 Reporte de Actividades</h4>
            <p style="color: var(--text-muted); margin-bottom: 10px;">Total de registros: <strong>${filtered.length}</strong></p>
            <table style="width: 100%; border-collapse: collapse; color: var(--text-main); font-size: 0.9rem;">
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <th style="padding: 8px; text-align: left;">Fecha y Hora</th>
                    <th style="padding: 8px; text-align: left;">Actividad</th>
                </tr>`;

        filtered.slice().reverse().forEach(activity => {
            html += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 8px; color: var(--text-muted); font-size: 0.85rem;">${activity.timestamp}</td>
                <td style="padding: 8px;">${activity.action}</td>
            </tr>`;
        });

        html += '</table></div > ';
        return html;
    },

    // Reporte de Productos
    generateProductsReport(category) {
        let filtered = this.products;

        if (category) {
            filtered = this.products.filter(p => p.category === category);
        }

        if (filtered.length === 0) {
            return '<p style="color: var(--text-muted); text-align: center;">No hay productos en esta categoría</p>';
        }

        let html = `<div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
            <h4 style="color: var(--primary); margin-bottom: 10px;">📦 Inventario de Productos</h4>
            <p style="color: var(--text-muted); margin-bottom: 10px;">Total de productos: <strong>${filtered.length}</strong></p>
            <table style="width: 100%; border-collapse: collapse; color: var(--text-main); font-size: 0.9rem;">
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <th style="padding: 8px; text-align: left;">Nombre</th>
                    <th style="padding: 8px; text-align: left;">Categoría</th>
                    <th style="padding: 8px; text-align: center;">Stock</th>
                </tr>`;

        filtered.forEach(product => {
            html += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 8px;">${product.name}</td>
                <td style="padding: 8px; color: var(--text-muted);">${product.category}</td>
                <td style="padding: 8px; text-align: center; ${product.stock < 5 ? 'color: #fca5a5; font-weight: bold;' : ''}">${product.stock}</td>
            </tr>`;
        });

        html += '</table></div>';
        return html;
    },

    // Reporte por Categorías
    generateCategoriesReport() {
        const categoriesList = {};

        this.products.forEach(product => {
            const cat = product.category || 'Sin categoría';
            if (!categoriesList[cat]) {
                categoriesList[cat] = { count: 0, stock: 0 };
            }
            categoriesList[cat].count++;
            categoriesList[cat].stock += product.stock || 0;
        });

        if (Object.keys(categoriesList).length === 0) {
            return '<p style="color: var(--text-muted); text-align: center;">No hay productos</p>';
        }

        let html = `<div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
            <h4 style="color: var(--primary); margin-bottom: 10px;">🏷️ Productos por Categoría</h4>
            <table style="width: 100%; border-collapse: collapse; color: var(--text-main); font-size: 0.9rem;">
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <th style="padding: 8px; text-align: left;">Categoría</th>
                    <th style="padding: 8px; text-align: center;">Cantidad</th>
                    <th style="padding: 8px; text-align: center;">Stock Total</th>
                </tr>`;

        Object.entries(categoriesList).forEach(([cat, data]) => {
            html += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 8px;">${cat}</td>
                <td style="padding: 8px; text-align: center;">${data.count}</td>
                <td style="padding: 8px; text-align: center;">${data.stock}</td>
            </tr>`;
        });

        html += '</table></div>';
        return html;
    },

    // Reporte de Stock Bajo
    generateLowStockReport(category) {
        let filtered = this.products.filter(p => (p.stock || 0) < 5);

        if (category) {
            filtered = filtered.filter(p => p.category === category);
        }

        if (filtered.length === 0) {
            return '<p style="color: var(--text-muted); text-align: center;">✓ No hay productos con stock bajo</p>';
        }

        let html = `<div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
            <h4 style="color: #fca5a5; margin-bottom: 10px;">⚠️ Productos con Stock Bajo</h4>
            <p style="color: var(--text-muted); margin-bottom: 10px;">Productos con menos de 5 unidades: <strong>${filtered.length}</strong></p>
            <table style="width: 100%; border-collapse: collapse; color: var(--text-main); font-size: 0.9rem;">
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <th style="padding: 8px; text-align: left;">Nombre</th>
                    <th style="padding: 8px; text-align: left;">Categoría</th>
                    <th style="padding: 8px; text-align: center;">Stock</th>
                </tr>`;

        filtered.forEach(product => {
            html += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 8px;">${product.name}</td>
                <td style="padding: 8px; color: var(--text-muted);">${product.category}</td>
                <td style="padding: 8px; text-align: center; color: #fca5a5; font-weight: bold;">${product.stock}</td>
            </tr>`;
        });

        html += '</table></div>';
        return html;
    },

    // Exportar reporte actual a CSV
    exportReport() {
        const type = document.getElementById('report-type').value;
        const resultContainer = document.getElementById('report-result');

        if (!resultContainer || resultContainer.innerText.includes('El reporte aparecerá')) {
            alert('Por favor genera un reporte primero');
            return;
        }

        let csv = '';
        let filename = `reporte_${type}_${new Date().getTime()}.csv`;

        switch (type) {
            case 'actividades':
                csv = 'Fecha y Hora,Actividad,Detalles\n';
                this.activities.slice().reverse().forEach(activity => {
                    csv += `"${activity.timestamp}","${activity.action}","${activity.details || ''}"\n`;
                });
                break;
            case 'productos':
                csv = 'Nombre,Categoría,Stock,Marca,Lote,Descripción\n';
                this.products.forEach(p => {
                    csv += `"${p.name}","${p.category}","${p.stock || 0}","${p.marca || ''}","${p.lote || ''}","${p.desc || ''}"\n`;
                });
                break;
            case 'categorias':
                csv = 'Categoría,Cantidad de Productos,Stock Total\n';
                const cats = {};
                this.products.forEach(p => {
                    const cat = p.category || 'Sin categoría';
                    if (!cats[cat]) cats[cat] = { count: 0, stock: 0 };
                    cats[cat].count++;
                    cats[cat].stock += p.stock || 0;
                });
                Object.entries(cats).forEach(([cat, data]) => {
                    csv += `"${cat}","${data.count}","${data.stock}"\n`;
                });
                break;
            case 'stock-bajo':
                csv = 'Nombre,Categoría,Stock\n';
                this.products.filter(p => (p.stock || 0) < 5).forEach(p => {
                    csv += `"${p.name}","${p.category}","${p.stock || 0}"\n`;
                });
                break;
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();

        this.logActivity('Reporte exportado', `Tipo: ${type}`);
    },

    // Filtrar categorías con búsqueda
    filterCategories(query) {
        const categories = [
            'Solventes', 'Ácido', 'Bases y sales', 'Polímeros', 'Vencidos', 'Congelados y refrigerados',
            'Equipos', 'Materiales de laboratorio', 'Materiales de limpieza', 'Artículos de oficina', 'Otros', 'Pro frejol'
        ];

        const suggestions = document.getElementById('category-suggestions');
        const searchValue = query.toLowerCase().trim();

        if (!searchValue) {
            suggestions.style.display = 'none';
            return;
        }

        const filtered = categories.filter(cat => cat.toLowerCase().includes(searchValue));

        if (filtered.length === 0) {
            suggestions.style.display = 'none';
            return;
        }

        suggestions.innerHTML = filtered.map(cat => `
            <div style="padding: 10px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.1); color: white;"
                onclick="app.selectCategory('${cat}'); event.stopPropagation();">
                ${cat}
            </div>
        `).join('');

        suggestions.style.display = 'block';
    },

    // Seleccionar categoría desde búsqueda
    selectCategory(category) {
        const select = document.getElementById('category-filter-admin');
        const searchInput = document.getElementById('category-search-admin');
        const suggestions = document.getElementById('category-suggestions');

        if (select) {
            select.value = category;
            select.dispatchEvent(new Event('change'));
        }
        if (searchInput) {
            searchInput.value = category;
        }
        suggestions.style.display = 'none';
        this.logActivity('Filtro aplicado', `Categoría: ${category}`);
    }
};

function toggleDateFields() {
    const categorySelect = document.getElementById('product-category');
    const dateFields = document.querySelectorAll('.date-field');
    if (!categorySelect) return;

    const hideDates = categoryHasNoDates(categorySelect.value);
    dateFields.forEach(field => {
        field.style.display = hideDates ? 'none' : 'block';
    });
}

function toggleEquipmentFields() {
    const categorySelect = document.getElementById('product-category');
    const stateField = document.querySelector('.state-field');
    if (!categorySelect || !stateField) return;

    stateField.classList.toggle('visible', isEquipment(categorySelect.value));
}

// Inicializar la aplicación cuando cargue el DOM
// Inicializar la aplicación cuando cargue el DOM
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('product-category')?.addEventListener('change', () => {
        toggleDateFields();
        toggleEquipmentFields();
    });

    document.getElementById('search-admin')?.addEventListener('input', () => app.filterProducts('admin'));

    document.getElementById('tu-select-categoria')?.addEventListener('change', () => app.filterProducts('admin'));

    // Cerrar modales haciendo clic en el fondo oscuro
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
    });

    // Cerrar modal con tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
        }
    });

    app.init();
    app.renderReportHistory();
    setupMirrorScrollbars();

    document.querySelectorAll('.table-responsive, .scroll-top-mirror').forEach(scrollContainer => {
        scrollContainer.scrollLeft = 0;
    });

    toggleDateFields();
    toggleEquipmentFields();
});


window.addEventListener('load', () => {
    document.querySelectorAll('.table-responsive, .scroll-top-mirror').forEach(scrollContainer => {
        scrollContainer.scrollLeft = 0;
    });
});

// Sincronizar barra de scroll superior con la tabla
function setupMirrorScrollbars() {
    const pairs = [
        { mirror: 'mirror-student', mirrorInner: 'mirror-inner-student', table: 'scroll-student', tableEl: 'table-student' },
        { mirror: 'mirror-admin', mirrorInner: 'mirror-inner-admin', table: 'scroll-admin', tableEl: 'table-admin' },
    ];

    pairs.forEach(({ mirror, mirrorInner, table, tableEl }) => {
        const mirrorEl = document.getElementById(mirror);
        const mirrorInnerEl = document.getElementById(mirrorInner);
        const tableWrapper = document.getElementById(table);

        if (!mirrorEl || !mirrorInnerEl || !tableWrapper) return;

        function syncWidth() {
            const tableNode = document.getElementById(tableEl);
            if (tableNode) {
                mirrorInnerEl.style.width = tableNode.scrollWidth + 'px';
            }
        }

        // Sincronizar scroll en ambas direcciones
        mirrorEl.addEventListener('scroll', () => {
            tableWrapper.scrollLeft = mirrorEl.scrollLeft;
        });
        tableWrapper.addEventListener('scroll', () => {
            mirrorEl.scrollLeft = tableWrapper.scrollLeft;
        });

        // Actualizar ancho al inicio y cuando hay cambios en la tabla
        syncWidth();
        new MutationObserver(syncWidth).observe(tableWrapper, { childList: true, subtree: true });
        window.addEventListener('resize', syncWidth);
    });
}


function imprimirPadron() {
    const productos = (app && Array.isArray(app.products)) ? app.products : [];
    // Si los productos todavía no se cargaron del JSON, evitamos que falle
    if (!productos || productos.length === 0) {
        alert("Los productos aún se están cargando o la lista está vacía. Espera un segundo e intenta de nuevo.");
        return;
    }

    const selectFiltro = document.getElementById('filtro-categoria-print');
    const categoriaSeleccionada = selectFiltro ? selectFiltro.value : 'todos';

    // Filtramos comparando tanto 'categoria' como 'category'
    const productosAImprimir = categoriaSeleccionada === 'todos'
        ? productos
        : productos.filter(p => {
            const catProd = p.categoria || p.category || '';
            return catProd.toString().trim().toLowerCase() === categoriaSeleccionada.toString().trim().toLowerCase();
        });

    if (productosAImprimir.length === 0) {
        alert("No hay productos en esta categoría para imprimir.");
        return;
    }

    // Abrimos la ventana de impresión
    const ventanaImpresion = window.open('', '', 'height=700,width=900');

    ventanaImpresion.document.write('<html><head><title>Imprimir Inventario</title>');
    ventanaImpresion.document.write('<style>');
    ventanaImpresion.document.write('body { font-family: Arial, sans-serif; padding: 20px; color: #333; }');
    ventanaImpresion.document.write('h2 { text-align: center; margin-bottom: 20px; }');
    ventanaImpresion.document.write('table { width: 100%; border-collapse: collapse; margin-top: 10px; }');
    ventanaImpresion.document.write('th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 12px; }');
    ventanaImpresion.document.write('th { background-color: #f2f2f2; }');
    ventanaImpresion.document.write('</style></head><body>');

    ventanaImpresion.document.write(`<h2>Padrón de Inventario - ${categoriaSeleccionada.toUpperCase()}</h2>`);

    ventanaImpresion.document.write('<table>');
    ventanaImpresion.document.write('<thead><tr><th>N°</th><th>Nombre</th><th>Categoría</th><th>Cantidad</th><th>Unidad</th><th>Marca</th><th>Lote</th></tr></thead>');
    ventanaImpresion.document.write('<tbody>');

    productosAImprimir.forEach((p, index) => {
        ventanaImpresion.document.write(`<tr>
            <td>${index + 1}</td>
            <td>${p.name || p.nombre || ''}</td>
            <td>${p.categoria || p.category || ''}</td>
            <td>${p.stock !== undefined ? p.stock : (p.cantidad || '')}</td>
            <td>${p.unit || p.unidad || ''}</td>
            <td>${p.location || p.marca || ''}</td>
            <td>${p.lote || ''}</td>
        </tr>`);
    });

    ventanaImpresion.document.write('</tbody></table>');
    ventanaImpresion.document.write('</body></html>');

    ventanaImpresion.document.close();

    setTimeout(() => {
        ventanaImpresion.print();
    }, 500);
} // <--- Aquí se cierra perfectamente la función imprimirPadron()

// 1. Cargar las categorías dinámicamente en el select al inicio
function cargarFiltroCategorias(productos) {
    const selectFiltro = document.getElementById('filtro-categoria-print');
    if (!selectFiltro) return;
    // ...resto del código...

    // Extraemos las categorías únicas buscando ambas opciones posibles
    const categorias = [...new Set(productos.map(p => p.categoria || p.category))];

    // Mantenemos la opción por defecto y agregamos las demás
    selectFiltro.innerHTML = '<option value="todos">Todas las categorías</option>';
    categorias.forEach(cat => {
        if (cat) {
            selectFiltro.innerHTML += `<option value="${cat}">${cat}</option>`;
        }
    });

    /// Asegúrate de corregir o mapear la variable global 'productos' directamente así:
}
// Listener global fue
document.addEventListener("DOMContentLoaded", () => {
    // 1. Ejecuta la verificación de datos iniciales aquí
    app.verificarDatosIniciales();

    const btnOpciones = document.getElementById("btnOpciones");

    if (btnOpciones) {
        btnOpciones.addEventListener("click", (e) => {
            e.stopPropagation();
            app.toggleOpcionesMenu();
        });
    }

    window.addEventListener("click", (e) => {
        const menu = document.getElementById("menu-opciones-flotante");
        const btnOpciones = document.getElementById("btnOpciones");
        if (menu && btnOpciones && !menu.contains(e.target) && !btnOpciones.contains(e.target)) {
            menu.classList.add("oculto");
        }
    });
});