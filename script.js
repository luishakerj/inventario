
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

    // Si el usuario ya asignó una categoría concreta, respetarla siempre.
    // Solo se autocategoriza cuando la categoría está vacía o es genérica.
    const categoryNorm = normalizeCategory(category);
    const esGenerica = !category || categoryNorm === 'otros' || categoryNorm === 'general';
    if (!esGenerica) {
        return category;
    }

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

// Actualiza el indicador visual del estado de sincronización con la nube.
// estado: 'ok' | 'error' | 'local'
function setSyncStatus(estado, mensaje) {
    const el = document.getElementById('sync-status');
    const txt = document.getElementById('sync-status-text');
    if (!el || !txt) return;

    const estilos = {
        ok: { bg: 'rgba(16, 185, 129, 0.18)', bd: 'rgba(16, 185, 129, 0.4)', color: '#10b981', dot: '#10b981' },
        error: { bg: 'rgba(239, 68, 68, 0.18)', bd: 'rgba(239, 68, 68, 0.4)', color: '#ef4444', dot: '#ef4444' },
        local: { bg: 'rgba(245, 158, 11, 0.18)', bd: 'rgba(245, 158, 11, 0.4)', color: '#f59e0b', dot: '#f59e0b' }
    };
    const s = estilos[estado] || estilos.local;
    el.style.background = s.bg;
    el.style.borderColor = s.bd;
    el.style.color = s.color;
    const dot = el.querySelector('span');
    if (dot) dot.style.background = s.dot;
    txt.textContent = mensaje || '';
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

    // Desaparecer después de 10 segundos
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 400);
    }, 10000);
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
    let value = String(unit || '').trim().replace(/\s+/g, ' ');
    if (!value) return '';
    if (/^kilos?$/i.test(value)) return 'KG';

    const match = value.match(/^(\d+(?:[.,]\d+)?)\s*(ML|L|MG|G|KG|U|KILO)s?$/i);
    if (!match) {
        const upper = value.toUpperCase();
        if (['KG', 'G', 'MG', 'L', 'ML', 'U'].includes(upper)) return upper === 'G' ? 'g' : upper;
        return value;
    }

    const amount = match[1].replace(',', '.');
    let u = match[2].toUpperCase();
    if (u === 'KILO') u = 'KG';
    if (u === 'G') u = 'g';
    return `${amount} ${u}`;
}

// Sistema de conversión métrica y agotamiento proporcional de stock
const UNIT_SYSTEM = {
    parse(unitStr) {
        if (!unitStr) return { dimension: 'COUNT', baseFactor: 1, unit: 'u', amount: 1 };
        const raw = String(unitStr).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        let amount = 1;
        let unitPart = raw;
        const matchNum = raw.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
        if (matchNum && matchNum[2]) {
            amount = parseFloat(matchNum[1].replace(',', '.')) || 1;
            unitPart = matchNum[2].trim();
        }

        // Masa: unidad base en gramos (g)
        // 1 KG = 1000 g, 1 g = 1 g (o gm), 1 MG = 0.001 g (1 g = 1000 mg)
        if (/^(kg|kgs|kilo|kilos|kilogramo|kilogramos)$/.test(unitPart)) {
            return { dimension: 'MASS', baseFactor: 1000 * amount, unit: 'KG', amount };
        }
        if (/^(g|gm|gms|gr|grs|gramo|gramos)$/.test(unitPart)) {
            return { dimension: 'MASS', baseFactor: 1 * amount, unit: 'g', amount };
        }
        if (/^(mg|mgs|miligramo|miligramos)$/.test(unitPart)) {
            return { dimension: 'MASS', baseFactor: 0.001 * amount, unit: 'MG', amount };
        }

        // Volumen: unidad base en mililitros (ML)
        // 1 L = 1000 ML, 1 ML = 1 ML
        if (/^(l|lt|lts|litro|litros)$/.test(unitPart)) {
            return { dimension: 'VOLUME', baseFactor: 1000 * amount, unit: 'L', amount };
        }
        if (/^(ml|mls|mililitro|mililitros)$/.test(unitPart)) {
            return { dimension: 'VOLUME', baseFactor: 1 * amount, unit: 'ML', amount };
        }

        // Conteo
        return { dimension: 'COUNT', baseFactor: 1 * amount, unit: 'u', amount };
    },

    toBase(amount, unitStr) {
        const p = this.parse(unitStr);
        return {
            dimension: p.dimension,
            baseValue: (parseFloat(amount) || 0) * p.baseFactor,
            parsed: p
        };
    },

    formatOptimal(baseValue, dimension) {
        if (baseValue <= 0) {
            return { stock: 0, unit: dimension === 'MASS' ? 'g' : dimension === 'VOLUME' ? 'ML' : 'u' };
        }

        if (dimension === 'MASS') {
            // baseValue en gramos
            if (baseValue >= 1000) {
                const kg = parseFloat((baseValue / 1000).toFixed(3));
                return { stock: kg, unit: 'KG' };
            } else if (baseValue >= 1) {
                const g = parseFloat(baseValue.toFixed(3));
                return { stock: g, unit: 'g' };
            } else {
                const mg = parseFloat((baseValue * 1000).toFixed(2));
                return { stock: mg, unit: 'MG' };
            }
        }

        if (dimension === 'VOLUME') {
            // baseValue en mililitros
            if (baseValue >= 1000) {
                const l = parseFloat((baseValue / 1000).toFixed(3));
                return { stock: l, unit: 'L' };
            } else {
                const ml = parseFloat(baseValue.toFixed(2));
                return { stock: ml, unit: 'ML' };
            }
        }

        return { stock: parseFloat(baseValue.toFixed(2)), unit: 'u' };
    }
};

function formatQuantityUnit(product) {
    const quantity = product.stock ?? 0;
    const unit = normalizeQuantityUnit(product.unit);
    if (isEquipment(product.category) || categoryHasNoMetadata(product.category)) {
        return `${quantity} / ${unit || '-'}`;
    }
    const hasPackagedAmount = /^(\d+(?:[.,]\d+)?)\s*(ML|L|MG|G|KG|U)$/i.test(String(unit).trim());
    if (isReagent(product.category) && hasPackagedAmount) {
        return `${quantity} / ${unit}`;
    }
    return `${quantity} ${unit || 'UND'}`.trim();
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
                    marca: 'LICC',
                    lote: 'LOTE-001',
                    detalle: 'Carga automática inicial para vista previa'
                }
            ];

            // Guarda los datos de prueba en el localStorage
            localStorage.setItem('inventario_reportes', JSON.stringify(datosPrueba));
        }
    },
    // Agrega esta función dentro de tu objeto 'app' o en script.js
    toggleOpcionesMenuStudent() {
        const menu = document.getElementById('menu-opciones-flotante-student');
        if (menu) {
            menu.classList.toggle('oculto');
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
        this.populateReportCategories();
        this.populateProductDropdown();
    },

    abrirModalPassword() {
        const adminView = document.getElementById('view-admin');
        if (!adminView || !adminView.classList.contains('active')) {
            alert('Solo el administrador con sesión activa puede cambiar la contraseña.');
            return;
        }

        const modal = document.getElementById('modalConfig');
        const form = document.getElementById('formChangePassword');
        const msgError = document.getElementById('msgError');
        if (form) form.reset();
        if (msgError) {
            msgError.textContent = '';
            msgError.style.color = '';
        }
        if (modal) {
            modal.classList.add('active');
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        }
    },

    cerrarModalPassword() {
        const modal = document.getElementById('modalConfig');
        if (modal) {
            modal.classList.remove('active');
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    },

    guardarNuevaPassword(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const adminView = document.getElementById('view-admin');
        if (!adminView || !adminView.classList.contains('active')) {
            alert('Solo el administrador con sesión activa puede cambiar la contraseña.');
            return;
        }

        const currentPassInput = document.getElementById('currentPassword');
        const newPassInput = document.getElementById('newPassword');
        const confirmPassInput = document.getElementById('confirmPassword');
        const msgError = document.getElementById('msgError');

        const currentPass = currentPassInput ? currentPassInput.value.trim() : '';
        const newPass = newPassInput ? newPassInput.value.trim() : '';
        const confirmPass = confirmPassInput ? confirmPassInput.value.trim() : '';

        const savedPassword = localStorage.getItem('passwordValida');
        const currentValidPassword = (savedPassword && savedPassword.trim() !== '') ? savedPassword : '1a2b3c4d5e';

        const isCurrentOk = (currentPass === currentValidPassword) || (!savedPassword && currentPass === '12345');

        if (!isCurrentOk) {
            if (msgError) {
                msgError.style.color = '#ef4444';
                msgError.textContent = 'La contraseña actual es incorrecta.';
            }
            return;
        }

        if (newPass.length < 4) {
            if (msgError) {
                msgError.style.color = '#ef4444';
                msgError.textContent = 'La nueva contraseña debe tener al menos 4 caracteres.';
            }
            return;
        }

        if (newPass !== confirmPass) {
            if (msgError) {
                msgError.style.color = '#ef4444';
                msgError.textContent = 'Las contraseñas nuevas no coinciden.';
            }
            return;
        }

        // Guardado inmediato en localStorage
        localStorage.setItem('passwordValida', newPass);

        if (msgError) {
            msgError.style.color = '#22c55e';
            msgError.textContent = '¡Contraseña actualizada de inmediato!';
        }

        if (typeof showToast === 'function') {
            showToast('Contraseña de administrador actualizada de inmediato', 'success');
        }

        setTimeout(() => {
            this.cerrarModalPassword();
        }, 800);
    },

    togglePasswordVisibility(inputId, btn) {
        const input = document.getElementById(inputId);
        if (!input) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        const icon = btn?.querySelector('i');
        if (icon) {
            icon.className = isPassword ? 'ph ph-eye-slash' : 'ph ph-eye';
        }
    },

    populateReportCategories(selectedCat = null) {
        const catSelect = document.getElementById('report-category');
        if (!catSelect) return;

        const currentVal = selectedCat !== null ? selectedCat : catSelect.value;
        const defaultCats = [
            'Solventes', 'Acido', 'Bases y sales', 'Polimeros',
            'Equipos', 'Materiales de laboratorio', 'Materiales de limpieza',
            'Articulos de oficina', 'Otros'
        ];

        // Obtener categorías únicas de los productos existentes
        const productCats = (this.products || [])
            .map(p => p.category || p.categoria)
            .filter(c => c && String(c).trim() !== '');

        const allCats = Array.from(new Set([...defaultCats, ...productCats]));
        allCats.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

        catSelect.innerHTML = '<option value="">Todas las categorías</option>';
        allCats.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat === 'Acido' ? 'Ácido' : cat;
            catSelect.appendChild(opt);
        });

        if (currentVal) {
            const foundOpt = Array.from(catSelect.options).find(o =>
                normalizeCategory(o.value) === normalizeCategory(currentVal)
            );
            if (foundOpt) {
                catSelect.value = foundOpt.value;
            }
        }
    },

    onReportCategoryChange(category) {
        const select = document.getElementById('report-item-name');
        const currentlySelected = select ? select.value : '';
        this.populateProductDropdown(category, currentlySelected);
    },

    populateProductDropdown(categoryFilter = null, preserveSelection = null) {
        const select = document.getElementById('report-item-name');
        const manualInput = document.getElementById('report-item-name-manual');
        if (!select) return;

        const currentVal = preserveSelection !== null ? preserveSelection : select.value;

        // Limpiar opciones existentes
        select.innerHTML = `
            <option value="">Seleccionar producto del inventario...</option>
            <option value="manual">Escribir nombre manualmente...</option>
        `;

        // Filtrar productos por categoría si se especifica
        let productsToFilter = this.products || [];
        if (categoryFilter && categoryFilter.trim() !== '') {
            productsToFilter = (this.products || []).filter(p =>
                normalizeCategory(p.category || p.categoria) === normalizeCategory(categoryFilter)
            );
        }

        // Ordenar productos alfabéticamente
        const sortedProducts = [...productsToFilter].sort((a, b) =>
            (a.name || a.nombre || '').localeCompare(b.name || b.nombre || '', 'es', { sensitivity: 'base' })
        );

        // Si había un producto seleccionado y no está en la categoría filtrada, preservarlo para no desactivarlo
        if (currentVal && currentVal !== 'manual' && currentVal !== '') {
            const isPresent = sortedProducts.some(p => (p.name || p.nombre) === currentVal);
            if (!isPresent) {
                const existingProd = (this.products || []).find(p => (p.name || p.nombre) === currentVal);
                if (existingProd) {
                    sortedProducts.unshift(existingProd);
                }
            }
        }

        // Agregar opciones de productos
        sortedProducts.forEach(product => {
            const name = product.name || product.nombre || 'Sin nombre';
            const stock = product.stock || 0;
            const unit = product.unit || '';
            const option = document.createElement('option');
            option.value = name;
            option.textContent = `${name} (Stock: ${stock} ${unit})`;
            select.appendChild(option);
        });

        // Restaurar la selección previa
        if (currentVal) {
            select.value = currentVal;
        }

        // Event listener al cambiar el insumo: sincroniza la categoría y sugiere unidad sin deseleccionar
        select.onchange = function () {
            if (manualInput) {
                manualInput.style.display = this.value === 'manual' ? 'block' : 'none';
                if (this.value !== 'manual') {
                    manualInput.value = '';
                }
            }

            if (this.value && this.value !== 'manual') {
                const selProd = (app.products || []).find(p => (p.name || p.nombre) === this.value);
                const unitSelect = document.getElementById('report-unit');
                const catSelect = document.getElementById('report-category');

                if (selProd) {
                    // Sincronizar categoría en el select sin dejarla en blanco
                    if (catSelect && selProd.category) {
                        let foundOption = Array.from(catSelect.options).find(o =>
                            normalizeCategory(o.value) === normalizeCategory(selProd.category)
                        );
                        if (!foundOption) {
                            const newOpt = document.createElement('option');
                            newOpt.value = selProd.category;
                            newOpt.textContent = selProd.category;
                            catSelect.appendChild(newOpt);
                            foundOption = newOpt;
                        }
                        catSelect.value = foundOption.value;
                    }

                    // Sugerir unidad según la escala
                    if (unitSelect) {
                        const parsed = UNIT_SYSTEM.parse(selProd.unit);
                        if (parsed.dimension === 'MASS') {
                            unitSelect.value = (parsed.unit === 'KG') ? 'g' : (parsed.unit || 'g');
                        } else if (parsed.dimension === 'VOLUME') {
                            unitSelect.value = (parsed.unit === 'L') ? 'ML' : (parsed.unit || 'ML');
                        } else if (parsed.dimension === 'COUNT') {
                            unitSelect.value = 'u';
                        }
                    }
                }
            }
        };
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
            marca: item.marca || item.location || item.brand || '-',
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
                const matchMarca = norm(rep.marca).includes(buscarQuery);
                const matchDetalle = norm(rep.detalle).includes(buscarQuery);
                const matchFecha = norm(rep.fecha).includes(buscarQuery);
                if (!matchNombre && !matchTipo && !matchCat && !matchLote && !matchMarca && !matchDetalle && !matchFecha) {
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
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: #94a3b8; font-size: 0.95rem;">No hay registros en el historial.</td></tr>`;
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

            // Orden de columnas: Nombre, Categoría, Cantidad, Lote, Marca, Fecha, Acción
            tr.innerHTML = `
                <td style="padding: 0.75rem; font-weight: 500; color: #f8fafc;">
                    <div>${escapeHtml(rep.nombre || '-')}</div>
                    ${rep.detalle && rep.detalle !== '-' ? `<div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">${escapeHtml(rep.detalle)}</div>` : ''}
                </td>
                <td style="padding: 0.75rem; color: #cbd5e1;">${escapeHtml(rep.categoria || '-')}</td>
                <td style="padding: 0.75rem; color: #38bdf8; font-weight: 600;">${rep.cantidad !== undefined ? escapeHtml(rep.cantidad) : '-'}</td>
                <td style="padding: 0.75rem; color: #94a3b8; font-family: monospace; font-size: 0.85rem;">${escapeHtml(rep.lote || '-')}</td>
                <td style="padding: 0.75rem; color: #94a3b8;">${escapeHtml(rep.marca || '-')}</td>
                <td style="padding: 0.75rem; color: #94a3b8; font-size: 0.8rem; white-space: nowrap;">${escapeHtml(rep.fecha || '-')}</td>
                <td style="padding: 0.75rem; text-align: center; white-space: nowrap;">
                    <span style="color: ${badgeColor}; font-weight: 600; background: ${badgeBg}; border: 1px solid ${badgeBorder}; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; display: inline-block;">
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
        // ── Intentar cargar desde Firestore primero (sincronización multi-máquina) ──
        if (window.firebaseReady && typeof escucharProductosFirebase === 'function') {
            this._initConFirebase();
        } else {
            // Firebase no disponible: cargar desde localStorage/data.js
            this._initLocal();
        }
    },

    // Inicialización cuando Firebase está disponible
    _initConFirebase() {
        console.log('[Firebase] Cargando inventario desde Firestore...');

        cargarProductosFirebase()
            .then(productosFirestore => {
                // Filtrar solo los que NO están en papelera
                const activos = productosFirestore.filter(p => !p._enPapelera);
                const enPapelera = productosFirestore.filter(p => p._enPapelera);

                if (typeof setSyncStatus === 'function') {
                    setSyncStatus('ok', 'Sincronizado (' + activos.length + ' productos)');
                }

                if (activos.length > 0) {
                    // Firestore tiene datos → usar esos (ignora localStorage y data.js)
                    console.log('[Firebase] Productos cargados desde Firestore:', activos.length);
                    this.products = activos.map(p => ({
                        ...p,
                        id: isNaN(p.id) ? p.id : parseInt(p.id),
                        category: autoCategorizarProducto(p),
                        unit: normalizeQuantityUnit(p.unit)
                    }));
                    this.trash = enPapelera;
                } else {
                    // Firestore vacío → cargar datos locales y subirlos a Firestore
                    console.log('[Firebase] Firestore vacío. Cargando datos locales y sincronizando...');
                    this._cargarDatosLocales();
                    // Subir datos locales a Firestore para que otras máquinas los vean
                    this.saveData();
                }

                this._finalizarInit();

                // ── Listener en tiempo real: cualquier cambio en otra máquina se refleja aquí ──
                if (typeof escucharProductosFirebase === 'function') {
                    escucharProductosFirebase(todosLosProductos => {
                        const activos = todosLosProductos.filter(p => !p._enPapelera);
                        const enPapelera = todosLosProductos.filter(p => p._enPapelera);

                        const remotos = activos.map(p => {
                            const copia = { ...p };
                            // El campo _pendienteDesde es solo local; Firestore no
                            // deberia traerlo, pero por si acaso se limpia aqui.
                            delete copia._pendienteDesde;
                            return {
                                ...copia,
                                id: isNaN(copia.id) ? copia.id : parseInt(copia.id),
                                category: autoCategorizarProducto(copia),
                                unit: normalizeQuantityUnit(copia.unit)
                            };
                        });

                        // Anti-carrera: si un producto local todavía no ha llegado en el
                        // snapshot (su escritura sigue en curso), se conserva para que no
                        // desaparezca de la tabla al guardarlo. PERO solo durante unos
                        // segundos: si el producto ya no existe en Firestore (fue borrado
                        // en otra máquina), no debe quedar "fantasma" para siempre.
                        const idsRemotos = new Set(remotos.map(p => String(p.id)));
                        const ahora = Date.now();
                        const pendientes = (this.products || []).filter(p =>
                            p && !p._enPapelera &&
                            !idsRemotos.has(String(p.id)) &&
                            // Solo conservar los recién creados/editados (últimos 20 s).
                            // Si ya pasó ese tiempo y Firestore no lo tiene, fue eliminado
                            // en otra máquina y no debe permanecer en la tabla.
                            p._pendienteDesde && (ahora - p._pendienteDesde) < 20000
                        );

                        this.products = [...remotos, ...pendientes];
                        this.trash = enPapelera;

                        // Actualizar la UI automáticamente manteniendo los filtros actuales
                        const currentView = document.querySelector('.view.active')?.id;
                        if (currentView === 'view-student') {
                            this.filterProducts('student');
                        } else if (currentView === 'view-admin') {
                            this.filterProducts('admin');
                        } else {
                            this.renderTables();
                        }

                        // Actualizar papelera si estamos en esa vista
                        const papeleraView = document.getElementById('view-papelera');
                        if (papeleraView && papeleraView.classList.contains('active')) {
                            if (typeof this.renderTrashTable === 'function') {
                                this.renderTrashTable();
                            }
                        }

                        if (typeof cargarFiltroCategorias === 'function') {
                            cargarFiltroCategorias(this.products);
                        }
                        console.log('[Firebase] 🔄 Inventario actualizado en tiempo real:', activos.length, 'productos, Papelera:', enPapelera.length);
                        if (typeof setSyncStatus === 'function') {
                            setSyncStatus('ok', 'Sincronizado (' + activos.length + ' productos)');
                        }
                    });
                }
            })
            .catch(err => {
                console.warn('[Firebase] Error al cargar desde Firestore, usando datos locales:', err);
                if (typeof setSyncStatus === 'function') {
                    setSyncStatus('error', 'Sin conexion (modo local)');
                }
                this._cargarDatosLocales();
                this._finalizarInit();
            });
    },

    // Inicialización sin Firebase (solo localStorage/data.js)
    _initLocal() {
        if (typeof setSyncStatus === 'function') {
            setSyncStatus('local', 'Sin conexion (modo local)');
        }
        this._cargarDatosLocales();
        this._finalizarInit();
    },

    // Carga datos desde localStorage o data.js
    _cargarDatosLocales() {
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
                        let p = { ...product, unit: normalizeQuantityUnit(product.unit) };
                        if (p.id === 190 && (p.name === 'Alcohol etilico' || (p.lote && p.lote.length > 20))) {
                            p.name = 'Alcohol metílico';
                            p.lote = '-';
                            updated = true;
                        }
                        return p;
                    });
                    if (updated) localStorage.setItem('cirna_inventory', JSON.stringify(this.products));
                    loaded = true;
                }
            } catch (e) { loaded = false; }
        }

        // Cargar papelera
        const savedTrash = localStorage.getItem('cirna_trash');
        if (savedTrash) {
            try { this.trash = JSON.parse(savedTrash); } catch (e) { this.trash = []; }
        }

        const looksLikePlaceholder = Array.isArray(this.products) &&
            this.products.length === 1 &&
            (this.products[0]?.nombre === 'Ejemplo 1' || this.products[0]?.name === 'Ejemplo 1');

        if (!loaded || looksLikePlaceholder) {
            if (typeof products !== 'undefined' && products.length > 0) {
                this.products = products;
            } else if (!loaded) {
                this.products = [...(this.defaultProducts || [])];
            }
            try { localStorage.setItem('cirna_inventory', JSON.stringify(this.products)); } catch (e) { }
        }
    },

    // Pasos finales comunes al iniciar (renderizado, actividades, navegación)
    _finalizarInit() {
        // Cargar actividades
        const savedActivities = localStorage.getItem('cirna_activities');
        if (savedActivities) {
            try {
                const parsedActivities = JSON.parse(savedActivities);
                this.activities = Array.isArray(parsedActivities) ? parsedActivities : [];
            } catch (e) { this.activities = []; }
        } else {
            this.activities = [];
            this.logActivity('Sistema inicializado', 'Bienvenido al Inventario LICC');
        }

        // Auto-categorizar productos
        this.products = (this.products || []).map(product => ({
            ...product,
            marca: product.marca || product.location || '',
            category: autoCategorizarProducto(product),
            unit: normalizeQuantityUnit(product.unit)
        }));

        try { localStorage.setItem('cirna_inventory', JSON.stringify(this.products)); } catch (e) { }

        this.renderTables();

        if (typeof cargarFiltroCategorias === 'function') {
            cargarFiltroCategorias(this.products);
        }

        this.navigate('view-menu');
    },


    saveData(productoEspecifico = null) {
        localStorage.setItem('cirna_inventory', JSON.stringify(this.products));
        localStorage.setItem('cirna_trash', JSON.stringify(this.trash));

        console.log('[DEBUG] saveData llamado - Total productos:', this.products.length, 'Firebase ready:', window.firebaseReady);

        if (!window.firebaseReady || typeof guardarProductoFirebase !== 'function') {
            console.warn('[DEBUG] Firebase no está listo o guardarProductoFirebase no está disponible');
            return;
        }

        // ── Sincronizar con Firebase Firestore (fire-and-forget) ──
        // IMPORTANTE: antes se subian TODOS los productos locales en cada guardado.
        // Eso causaba que una maquina con datos desfasados sobrescribiera en
        // Firestore los cambios recientes de OTRA maquina (el producto nuevo no
        // aparecia, o desaparecia el de la otra maquina).
        // Ahora, si se indica un producto concreto, se sube SOLO ese.
        // Quita los campos internos de la app antes de subir a Firestore
        // (_pendienteDesde es solo de control local y no debe persistir en la nube).
        const limpiar = (p) => {
            const copia = { ...p };
            delete copia._pendienteDesde;
            return copia;
        };

        if (productoEspecifico) {
            guardarProductoFirebase({ ...limpiar(productoEspecifico), id: String(productoEspecifico.id) })
                .then(docId => console.log('[DEBUG] Producto sincronizado:', docId))
                .catch(err => console.warn('[Firebase] Error al sincronizar producto:', err));
            return;
        }

        // Si no se indica uno concreto (p. ej. sincronizacion inicial de la carga
        // local completa), se suben todos. Solo ocurre una vez al arrancar con
        // Firestore vacio.
        console.log('[DEBUG] Sincronizando', this.products.length, 'productos con Firebase...');
        this.products.forEach(product => {
            guardarProductoFirebase({ ...limpiar(product), id: String(product.id) })
                .then(docId => console.log('[DEBUG] Producto sincronizado:', docId))
                .catch(err => console.warn('[Firebase] Error al sincronizar producto:', err));
        });
    },

    deleteProduct(id) {
        const index = this.products.findIndex(p => String(p.id) === String(id));
        if (index !== -1) {
            const deletedItem = this.products.splice(index, 1)[0];

            // 1. Marcar explícitamente en el objeto local que está en la papelera
            deletedItem._enPapelera = true;

            if (!Array.isArray(this.trash)) {
                this.trash = [];
            }
            this.trash.push(deletedItem);

            // Persistir en localStorage. NO usar saveData() sin argumento aquí,
            // porque re-subiría TODOS los productos y podría pisar en Firestore los
            // cambios recientes de otra máquina. El borrado se sincroniza aparte
            // (abajo) con saveData(productoConcreto).
            localStorage.setItem('cirna_inventory', JSON.stringify(this.products));
            localStorage.setItem('cirna_trash', JSON.stringify(this.trash));

            // 2. Marcar como eliminado en Firebase (solo este documento)
            if (window.firebaseReady && typeof guardarProductoFirebase === 'function') {
                guardarProductoFirebase({ ...deletedItem, id: String(deletedItem.id), _enPapelera: true })
                    .catch(err => console.warn('[Firebase] Error al marcar como eliminado:', err));
            }

            // 3. Re-renderizar ambas tablas
            this.renderTables();
            if (typeof this.renderTrashTable === 'function') {
                this.renderTrashTable();
            }

            const nombreProducto = deletedItem.name || deletedItem.nombre || 'el producto';
            showToast(`Se eliminó "${nombreProducto}" con éxito`, 'success');

            if (typeof this.logActivity === 'function') {
                this.logActivity(`Producto eliminado: ${nombreProducto}`, 'Movido a la papelera de reciclaje');
            }

            // 4. Navegar automáticamente a la papelera
            this.navigate('view-papelera');
        }
    },

    renderTrashTable() {
        const trashBody = document.getElementById('table-body-papelera');
        if (!trashBody) return;

        trashBody.innerHTML = '';

        if (!Array.isArray(this.trash) || this.trash.length === 0) {
            trashBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">La papelera está vacía</td></tr>`;
            return;
        }

        this.trash.forEach((p) => {
            const tr = document.createElement('tr');
            // Usar p.id en lugar del índice para evitar errores si la lista cambia
            tr.innerHTML = `
                <td>${p.name || p.nombre || '-'}</td>
                <td>${p.category || p.categoria || '-'}</td>
                <td>${p.quantity || p.cantidad || p.stock || 0} ${p.unit || ''}</td>
                <td style="text-align: right;">
                    <button class="btn-icon" onclick="app.restoreProduct('${p.id}')" title="Restaurar"><i class="ph ph-arrow-counter-clockwise"></i></button>
                    <button class="btn-icon" onclick="app.permanentDelete('${p.id}')" title="Eliminar definitivamente" style="color: #ef4444;"><i class="ph ph-x"></i></button>
                </td>
            `;
            trashBody.appendChild(tr);
        });
    },

    restoreProduct(id) {
        const index = this.trash.findIndex(p => String(p.id) === String(id));
        if (index === -1) {
            console.error('[ERROR] Producto no encontrado en papelera:', id);
            return;
        }

        const restoredItem = this.trash.splice(index, 1)[0];
        restoredItem._enPapelera = false;

        this.products.push(restoredItem);
        localStorage.setItem('cirna_inventory', JSON.stringify(this.products));
        localStorage.setItem('cirna_trash', JSON.stringify(this.trash));
        this.renderTables();
        this.renderTrashTable();

        // ── Restaurar en Firebase (quitar flag _enPapelera) ──
        if (window.firebaseReady && typeof guardarProductoFirebase === 'function') {
            guardarProductoFirebase({ ...restoredItem, id: String(restoredItem.id), _enPapelera: false })
                .then(() => {
                    console.log('[Firebase] ✅ Producto restaurado y sincronizado:', restoredItem.name || restoredItem.nombre);
                })
                .catch(err => console.warn('[Firebase] Error al restaurar producto:', err));
        }

        showToast(`Producto "${restoredItem?.name || restoredItem?.nombre || 'restaurado'}" restaurado correctamente`, 'success');
    },

    permanentDelete(id) {
        const index = this.trash.findIndex(p => String(p.id) === String(id));
        if (index === -1) {
            console.error('[ERROR] Producto no encontrado en papelera:', id);
            return;
        }

        if (confirm("¿Estás seguro de eliminar este insumo permanentemente?")) {
            const deletedItem = this.trash.splice(index, 1)[0];
            localStorage.setItem('cirna_trash', JSON.stringify(this.trash));
            this.renderTrashTable();

            // ── Eliminar permanentemente de Firebase ──
            if (window.firebaseReady && typeof eliminarProductoFirebase === 'function') {
                eliminarProductoFirebase(String(deletedItem?.id))
                    .then(() => {
                        console.log('[Firebase] ✅ Producto eliminado permanentemente:', deletedItem.name || deletedItem.nombre);
                    })
                    .catch(err => console.warn('[Firebase] Error al eliminar permanentemente:', err));
            }

            showToast(`Se eliminó "${deletedItem?.name || deletedItem?.nombre || 'el producto'}" permanentemente con éxito`, 'success');
        }
    },
    // ---------------------



    // Navegación entre vistas
    // Navegación entre vistas
    navigate(viewId) {
        // 1. Ocultar todas las vistas quitando la clase y limpiando estilos en línea
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
            v.style.display = ''; // Limpia el 'none' o 'flex' previo
        });

        // 2. Activar únicamente la vista solicitada
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.add('active');
        } else {
            console.error(`No existe un elemento con id="${viewId}"`);
        }

        // 3. Renderizar datos
        this.renderTables();

        // 4. Actualizar papelera si aplica
        if (viewId === 'view-papelera' && typeof this.renderTrashTable === 'function') {
            this.renderTrashTable();
        }

        // 5. Reiniciar scrolls horizontales
        document.querySelectorAll('.table-responsive, .scroll-top-mirror').forEach(scrollContainer => {
            scrollContainer.scrollLeft = 0;
        });

        // 6. Limpiar campos de búsqueda
        const searchStudent = document.getElementById('search-student');
        if (searchStudent) searchStudent.value = '';
        const searchAdmin = document.getElementById('search-admin');
        if (searchAdmin) searchAdmin.value = '';
    },





    // Renderizar HTML de las tablas
    // Renderizar HTML de las tablas
    renderTables(dataToRender = this.products) {
        console.log('[DEBUG] renderTables llamado - Productos a renderizar:', dataToRender.length);

        const studentBody = document.getElementById('table-body-student');
        const adminBody = document.getElementById('table-body-admin');
        const studentTable = document.getElementById('table-student');
        const adminTable = document.getElementById('table-admin');

        if (!studentBody || !adminBody) return;
        if (!Array.isArray(dataToRender)) dataToRender = [];

        // NOTA: aqui antes habia un segundo filtrado que leia elementos con id
        // 'search-input' / 'inputBusqueda' y 'category-filter' / 'selectCategoria',
        // que NO existen en el HTML (los reales son 'search-student' y
        // 'search-admin'). Ese filtrado fantasma dejaba 'dataToRender' con datos
        // ya filtrados o vacios y hacia que el buscador no mostrara resultados.
        // El filtrado (busqueda + categoria) lo hace ahora unicamente
        // app.filterProducts(), que es la unica fuente de verdad y conoce la vista
        // activa (student/admin). Aqui solo se renderiza lo que llega.

        // Optimización: usar DocumentFragment para mejor rendimiento
        const studentFragment = document.createDocumentFragment();
        const adminFragment = document.createDocumentFragment();

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
        document.querySelectorAll('th.lote-column, .lot-column').forEach(column => {
            if (column.tagName === 'TH') {
                column.textContent = showLabMaterialColumns ? 'Medidas/Volumen' : column.classList.contains('lote-column') && column.closest('#table-admin')
                    ? 'Lote / Código'
                    : 'Lote';
            }
        });

        if (dataToRender.length === 0) {
            const emptyColsStudent = (hasDateColumns ? 10 : 8) - (hasMetadataColumns ? 0 : 3); // +1 por columna unidad
            const emptyColsAdmin = 7; // 7 columnas en la tabla de admin: Nombre, Categoría, Cantidad, Unidad, Marca, Lote, Acciones
            const emptyMsgStudent = `<tr><td colspan="${emptyColsStudent}" class="text-center" style="padding: 2rem; color: var(--text-muted);">No se encontraron productos.</td></tr>`;
            const emptyMsgAdmin = `<tr><td colspan="${emptyColsAdmin}" class="text-center" style="padding: 2rem; color: var(--text-muted);">No se encontraron productos.</td></tr>`;
            studentBody.innerHTML = emptyMsgStudent;
            adminBody.innerHTML = emptyMsgAdmin;
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
            const unitVal = p.unit || p.unidad || '-';
            const quantityLabel = formatQuantityUnit(p);

            const isEquipRow = equipment || p.category === 'Equipos' || p.categoria === 'Equipos';
            const rowClass = isEquipRow ? 'equipment-product-row' : '';

            const brandVal = marcaReal;
            const loteVal = loteReal;
            const descVal = p.desc || p.descripcion || '-';

            const commonCells = `
        <td class="name-column">${escapeHtml(p.name || p.nombre || '-')}</td>
        <td class="category-column">${escapeHtml(p.category || p.categoria || '-')}</td>
        <td class="quantity-column"><span class="stock-badge ${stockClass}">${escapeHtml(stockVal)}</span></td>
        <td class="unit-column">${escapeHtml(unitVal)}</td>
        <td class="marca-column">${escapeHtml(brandVal)}</td>
        <td class="lote-column">${escapeHtml(loteVal)}</td>
        ${prodCell}
        ${expCell}
        <td class="desc-column">${escapeHtml(descVal)}</td>
    `;

            const adminCells = `
        <td class="name-column">${escapeHtml(p.name || p.nombre || '-')}</td>
        <td class="category-column">${escapeHtml(p.category || p.categoria || '-')}</td>
        <td class="quantity-column"><span class="stock-badge ${stockClass}">${escapeHtml(stockVal)}</span></td>
        <td class="unit-column">${escapeHtml(unitVal)}</td>
        <td class="marca-column">${escapeHtml(brandVal)}</td>
        <td class="lote-column">${escapeHtml(loteVal)}</td>
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
            studentFragment.appendChild(trStudent);

            const trAdmin = document.createElement('tr');
            trAdmin.setAttribute('class', rowClass);
            trAdmin.innerHTML = `
        ${adminCells}
        <td class="action-buttons text-right">
            <button class="btn-icon" onclick="app.viewProduct(${p.id})" title="Ver"><i class="ph ph-eye"></i></button>
            <button class="btn-icon" onclick="app.editProduct(${p.id})" title="Editar"><i class="ph ph-pencil"></i></button>
            <button class="btn-icon text-danger" onclick="app.deleteProduct(${p.id})" title="Eliminar"><i class="ph ph-trash"></i></button>
        </td>
    `;

            adminFragment.appendChild(trAdmin);
        });

        // Optimización: agregar todos los elementos de una vez
        studentBody.appendChild(studentFragment);
        adminBody.appendChild(adminFragment);

        console.log('[DEBUG] Renderizado completado - Productos en tabla estudiante:', studentBody.children.length, 'Productos en tabla admin:', adminBody.children.length);

        requestAnimationFrame(() => {
            document.querySelectorAll('.table-responsive, .scroll-top-mirror').forEach(scrollContainer => {
                scrollContainer.scrollLeft = 0;
            });
        });
    },



    filterProducts(viewRole) {
        console.log('[DEBUG] filterProducts llamado - Vista:', viewRole, 'app.products:', this.products.length);

        const inputId = viewRole === 'student' ? 'search-student' : 'search-admin';
        const inputEl = document.getElementById(inputId);
        const rawQuery = inputEl ? inputEl.value : '';

        console.log('[DEBUG] Input ID:', inputId, 'Elemento encontrado:', !!inputEl, 'Valor:', rawQuery);

        const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const query = normalize(rawQuery);

        console.log('[DEBUG] Filtrando productos - Vista:', viewRole, 'Query:', query, 'Total productos:', this.products.length);

        // Usar el filtro de categoría correcto según la vista
        const categorySelectId = viewRole === 'student' ? 'category-filter-student' : 'category-filter-admin';
        const categorySelect = document.getElementById(categorySelectId);
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
        const stock = parseFloat(document.getElementById('product-stock')?.value) || 0;

        console.log('[DEBUG] Guardando producto:', { idInput, name, category, stock });

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
                this.products[index] = { id, name, category, stock: parseFloat(stock), location, marca: location, image, desc, lote, prodDate, expDate, unit, state, _pendienteDesde: Date.now() };
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
                showToast('Se ha editado correctamente', 'success');

                // Subir a Firestore SOLO este producto editado, para no
                // sobrescribir con datos locales desfasados los cambios de otra máquina.
                this.saveData(this.products[index]);
            }
        } else {
            // Crear nuevo. El id se basa en el timestamp para que sea único
            // entre distintas máquinas/navegadores (el antiguo Math.max+1 podía
            // coincidir con un producto creado en OTRA máquina y sobrescribirlo,
            // haciendo que el producto nuevo "desapareciera" o no apareciera).
            const newId = Date.now() + Math.floor(Math.random() * 10000);
            const nuevoProducto = { id: newId, name, category, stock: parseFloat(stock), location, marca: location, image, desc, lote, prodDate, expDate, unit, state, _pendienteDesde: Date.now() };
            console.log('[DEBUG] Producto nuevo creado:', nuevoProducto);
            this.products.push(nuevoProducto);

            // Subir el producto nuevo a Firestore de inmediato. Así el snapshot del
            // listener ya lo incluye y no se pierde por la carrera de sincronización.
            if (window.firebaseReady && typeof guardarProductoFirebase === 'function') {
                guardarProductoFirebase({ ...nuevoProducto, id: String(nuevoProducto.id) })
                    .then(() => showToast('Producto sincronizado con la nube', 'success'))
                    .catch(err => {
                        console.error('[Firebase] ❌ Error al guardar producto nuevo:', err);
                        const motivo = err && (err.code === 'permission-denied')
                            ? 'Permisos de Firestore denegados. Revisa las reglas en la consola de Firebase.'
                            : (err && err.message) || 'Error desconocido';
                        showToast('No se pudo sincronizar con la nube: ' + motivo, 'error');
                    });
            } else {
                console.warn('[Firebase] ⚠️ No se pudo sincronizar el producto nuevo (Firestore no disponible). Solo se guardó en este dispositivo.');
                showToast('Guardado solo en este dispositivo (sin conexión a la nube)', 'error');
            }
            console.log('[DEBUG] Total productos después de guardar:', this.products.length);
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
            showToast('Producto creado correctamente', 'success');
        }

        console.log('[DEBUG] Guardando datos y renderizando tablas...');
        // Persistir el inventario en localStorage (la subida a Firestore de este
        // producto ya se hizo arriba de forma individual para no pisar cambios de
        // otras máquinas). Aquí llamamos a saveData SIN argumento para que
        // reescriba el localStorage; si Firebase está listo y no hay producto
        // concreto, saveData subiría todo, así que para evitar eso guardamos
        // directamente el estado local tal cual.
        localStorage.setItem('cirna_inventory', JSON.stringify(this.products));
        localStorage.setItem('cirna_trash', JSON.stringify(this.trash));
        console.log('[DEBUG] Tablas renderizadas. Total productos en this.products:', this.products.length);

        // Mantener el filtro actual después de guardar
        const currentView = document.querySelector('.view.active')?.id;
        if (currentView === 'view-student') {
            this.filterProducts('student');
        } else if (currentView === 'view-admin') {
            this.filterProducts('admin');
        } else {
            this.renderTables();
        }

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
                <span class="label">Stock / Cantidad</span>
                <span class="value" style="font-weight: 600; color: #38bdf8;">${escapeHtml(formatQuantityUnit(p))}</span>
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
        const nameManualInput = document.getElementById('report-item-name-manual');
        const dateInput = document.getElementById('report-use-date');
        const qtyInput = document.getElementById('report-quantity-used');
        const unitInput = document.getElementById('report-unit');

        let categoriaInsumo = categoryInput?.value?.trim() || 'Insumo general';

        // Usar el nombre del dropdown si está seleccionado, si no usar el input manual
        let nombreInsumo = nameInput?.value?.trim() || '';
        if (nombreInsumo === 'manual' || nombreInsumo === '') {
            nombreInsumo = nameManualInput?.value?.trim() || 'Insumo';
        }

        const fechaUsoRaw = dateInput?.value;
        const horaActual = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const fechaUso = fechaUsoRaw ? `${fechaUsoRaw} ${horaActual} ` : new Date().toLocaleString('es-ES');
        const cantidadValor = qtyInput?.value || '1';
        const unidadSeleccionada = unitInput?.value || 'unidad';
        const cantidadUso = `${cantidadValor} ${unidadSeleccionada}`;

        // Filtrar productos por categoría para la búsqueda
        let productosParaBuscar = this.products;
        if (categoriaInsumo && categoriaInsumo !== 'Insumo general') {
            productosParaBuscar = this.products.filter(p =>
                normalizeCategory(p.category || p.categoria) === normalizeCategory(categoriaInsumo)
            );
        }

        // ============================================
        // DESCUENTO AUTOMÁTICO DE STOCK (consumo)
        // Busca el insumo/reactivo en el inventario y
        // resta la cantidad utilizada de la base de datos.
        // ============================================
        const normalizarTexto = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

        const cantidadNum = parseFloat(String(cantidadValor).replace(',', '.')) || 0;

        // Búsqueda robusta del producto con múltiples estrategias
        const nombreBuscadoNormalizado = normalizarTexto(nombreInsumo);

        // Estrategia 1: Coincidencia exacta en productos filtrados por categoría
        let producto = productosParaBuscar.find(p =>
            normalizarTexto(p.name || p.nombre) === nombreBuscadoNormalizado
        );

        // Estrategia 1b: Coincidencia exacta en TODO el inventario (por si la categoría no coincide)
        if (!producto && productosParaBuscar !== this.products) {
            producto = this.products.find(p =>
                normalizarTexto(p.name || p.nombre) === nombreBuscadoNormalizado
            );
        }

        // Estrategia 2: El nombre del producto contiene lo buscado
        if (!producto) {
            producto = productosParaBuscar.find(p =>
                normalizarTexto(p.name || p.nombre).includes(nombreBuscadoNormalizado)
            ) || this.products.find(p =>
                normalizarTexto(p.name || p.nombre).includes(nombreBuscadoNormalizado)
            );
        }

        // Estrategia 3: Lo buscado contiene parte del nombre del producto
        if (!producto) {
            producto = productosParaBuscar.find(p =>
                nombreBuscadoNormalizado.includes(normalizarTexto(p.name || p.nombre))
            ) || this.products.find(p =>
                nombreBuscadoNormalizado.includes(normalizarTexto(p.name || p.nombre))
            );
        }

        // Estrategia 4: Coincidencia de palabras clave (sustituciones comunes)
        if (!producto) {
            const sustituciones = {
                'etanol': ['ethanol', 'alcohol etilico', 'alcohol etílico'],
                'etano': ['ethanol', 'ethane', 'etanol'],
                'alcohol': ['ethanol', 'alcohol etilico', 'alcohol etílico', 'metanol', 'isopropanol'],
                'metanol': ['methanol'],
                'acetona': ['acetone'],
                'acido': ['acid'],
                'agua': ['water']
            };

            const palabrasClave = Object.keys(sustituciones);
            for (const clave of palabrasClave) {
                if (nombreBuscadoNormalizado.includes(clave)) {
                    const alternativas = sustituciones[clave];
                    for (const alt of alternativas) {
                        producto = this.products.find(p =>
                            normalizarTexto(p.name || p.nombre).includes(normalizarTexto(alt))
                        );
                        if (producto) break;
                    }
                    if (producto) break;
                }
            }
        }

        // Si se encontró el producto, asegurar la categoría real del producto
        if (producto && producto.category) {
            categoriaInsumo = producto.category;
        }

        let detalleConsumo = 'Reporte de uso registrado (producto no encontrado en inventario)';
        let loteConsumo = '-';
        let stockRestante = null;

        if (producto && cantidadNum > 0) {
            const stockActual = parseFloat(producto.stock) || 0;
            const unidadProd = producto.unit || '';

            // Conversión y agotamiento proporcional de stock
            const prodBase = UNIT_SYSTEM.toBase(stockActual, unidadProd);
            const usoBase = UNIT_SYSTEM.toBase(cantidadNum, unidadSeleccionada);

            const textoStockAnterior = `${stockActual} ${unidadProd}`.trim();
            const textoDescontado = `${cantidadNum} ${unidadSeleccionada}`;

            let nuevoStockVal = 0;
            let nuevaUnidad = unidadProd;

            if (prodBase.dimension === usoBase.dimension) {
                const stockRestanteBase = Math.max(0, prodBase.baseValue - usoBase.baseValue);
                const optimal = UNIT_SYSTEM.formatOptimal(stockRestanteBase, prodBase.dimension);
                nuevoStockVal = optimal.stock;
                nuevaUnidad = optimal.unit;
            } else {
                nuevoStockVal = Math.max(0, parseFloat((stockActual - cantidadNum).toFixed(3)));
            }

            producto.stock = nuevoStockVal;
            producto.unit = nuevaUnidad;
            producto._pendienteDesde = Date.now();
            stockRestante = `${nuevoStockVal} ${nuevaUnidad}`.trim();
            loteConsumo = producto.lote || producto.codigo || '-';

            // Sincronizar SOLO el producto cuyo stock cambió (no todo el inventario),
            // para no sobrescribir en Firestore los cambios recientes de otra máquina.
            this.saveData(producto);
            this.renderTables();

            detalleConsumo = stockActual > 0
                ? `Consumo registrado. Stock anterior: ${textoStockAnterior}, descontado: ${textoDescontado}, stock restante: ${stockRestante}`
                : `Consumo registrado. El stock ya estaba en 0, no se pudo descontar más.`;

            this.logActivity(
                `Consumo de inventario: ${producto.name || producto.nombre}`,
                `Se descontaron ${textoDescontado} del stock. Stock restante: ${stockRestante}`
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
            marca: producto ? (producto.marca || producto.brand || producto.location || '-') : '-',
            lote: loteConsumo,
            detalle: detalleConsumo,
            fecha: fechaUso
        });

        this.logActivity(`Reporte generado: ${nombreInsumo} `, `Cantidad: ${cantidadValor} ${unidadSeleccionada}, Categoría: ${categoriaInsumo} ${stockRestante !== null ? `| Stock restante: ${stockRestante}` : ''} `);

        const resultadoDiv = document.getElementById('report-result');
        if (resultadoDiv) {
            resultadoDiv.innerHTML = `
    <div style="background: rgba(16, 185, 129, 0.15); padding: 1.2rem; border-radius: 8px; border: 1px solid #10b981; color: #f8fafc; text-align: center; margin-top: 1rem;">
                    <h3 style="color: #10b981; margin-bottom: 0.4rem; font-size: 1.2rem;">✅ ¡Reporte guardado con éxito!</h3>
                    <p style="margin: 0.2rem 0; color: #cbd5e1; font-size: 0.95rem;">Se registró el uso de <strong>${nombreInsumo}</strong> (Cantidad: ${cantidadValor} ${unidadSeleccionada}).</p>
                    ${stockRestante !== null
                    ? `<p style="margin: 0.2rem 0; color: ${producto?.stock <= 0 ? '#ef4444' : '#10b981'}; font-size: 0.95rem;">Stock restante en inventario: <strong>${stockRestante}</strong>${producto?.stock <= 0 ? ' ⚠️ Producto agotado' : ''}</p>`
                    : `<p style="margin: 0.2rem 0; color: #f59e0b; font-size: 0.85rem;">⚠️ No se encontró el producto en el inventario, solo se registró el reporte.</p>`}
                    <p style="margin: 0.2rem 0; color: #94a3b8; font-size: 0.85rem;">Fecha: ${fechaUso} | Categoría: ${categoriaInsumo}</p>
                    <p style="margin-top: 0.5rem; font-size: 0.85rem; color: #38bdf8;">Ya puedes consultarlo en el botón <strong>"Ver Historial"</strong>.</p>
                </div>
    `;

            // Ocultar el mensaje después de 3 segundos
            setTimeout(() => {
                resultadoDiv.style.display = 'none';
            }, 3000);
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
document.addEventListener('DOMContentLoaded', () => {

    // Nota: la conexion en tiempo real con Firebase la gestiona app.init()
    // (->_initConFirebase), que ya registra UN listener y normaliza los datos
    // (auto-categorias, unidades, ids, papelera). Aqui NO se debe registrar otro
    // listener: si se hacía, se sobreescribia app.products con los datos crudos
    // de Firestore (sin normalizar) y las tablas quedaban inconsistentes.

    // Listeners de la interfaz existentes
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
    //cerral modal con tecla escape
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
function imprimirPadron(tipoVista) {
    const productos = (app && Array.isArray(app.products)) ? app.products : [];

    if (!productos || productos.length === 0) {
        alert("Los productos aún se están cargando o la lista está vacía.");
        return;
    }

    // 1. Obtener el select correspondiente
    let selectFiltro = null;
    if (tipoVista === 'admin') {
        selectFiltro = document.getElementById('filtro-categoria-print-admin');
    } else if (tipoVista === 'student') {
        selectFiltro = document.getElementById('filtro-categoria-print-student');
    }

    if (!selectFiltro) {
        selectFiltro = document.getElementById('filtro-categoria-print-admin') ||
            document.getElementById('filtro-categoria-print-student') ||
            document.getElementById('filtro-categoria-print');
    }

    const categoriaSeleccionada = selectFiltro ? selectFiltro.value : 'todos';

    // Función helper para remover tildes y caracteres especiales
    const limpiarTexto = (texto) => {
        return (texto || '')
            .toString()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Remueve tildes (á -> a, é -> e)
            .trim()
            .toLowerCase();
    };

    const categoriaLimpia = limpiarTexto(categoriaSeleccionada);

    // 2. Filtrar productos comparando texto normalizado
    const productosAImprimir = (categoriaLimpia === 'todos' || categoriaLimpia === 'seleccion')
        ? productos
        : productos.filter(p => {
            const catProd = limpiarTexto(p.categoria || p.category || '');
            return catProd === categoriaLimpia;
        });

    if (productosAImprimir.length === 0) {
        alert("No hay productos en esta categoría para imprimir.");
        return;
    }

    // 3. Ventana de Impresión
    const ventanaImpresion = window.open('', '', 'height=700,width=900');

    ventanaImpresion.document.write('<html><head><title>Imprimir Inventario</title>');
    ventanaImpresion.document.write('<style>');
    ventanaImpresion.document.write('body { font-family: Arial, sans-serif; padding: 20px; color: #333; }');
    ventanaImpresion.document.write('h2 { text-align: center; margin-bottom: 20px; text-transform: uppercase; }');
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
            <td>${p.nombre || p.name || ''}</td>
            <td>${p.categoria || p.category || ''}</td>
            <td>${p.stock !== undefined ? p.stock : (p.cantidad || '')}</td>
            <td>${p.unidad || p.unit || ''}</td>
            <td>${p.marca || p.location || ''}</td>
            <td>${p.lote || ''}</td>
        </tr>`);
    });

    ventanaImpresion.document.write('</tbody></table></body></html>');
    ventanaImpresion.document.close();

    setTimeout(() => {
        ventanaImpresion.print();
    }, 500);
}
// <--- Aquí se cierra perfectamente la función imprimirPadron()

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
// ==========================================
// LISTENERS GLOBALES Y GESTIÓN DE ACCESOS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Verificación de datos iniciales
    if (typeof app !== 'undefined' && app.verificarDatosIniciales) {
        app.verificarDatosIniciales();
    }

    // 2. Menú flotante de opciones (Admin)
    const btnOpciones = document.getElementById("btnOpciones");
    if (btnOpciones) {
        btnOpciones.addEventListener("click", (e) => {
            e.stopPropagation();
            if (typeof app !== 'undefined' && app.toggleOpcionesMenu) {
                app.toggleOpcionesMenu();
            }
        });
    }

    // 3. Cerrar menús flotantes al hacer clic afuera
    window.addEventListener("click", (e) => {
        const menuAdmin = document.getElementById("menu-opciones-flotante");
        const btnAdmin = document.getElementById("btnOpciones");
        if (menuAdmin && btnAdmin && !menuAdmin.contains(e.target) && !btnAdmin.contains(e.target)) {
            menuAdmin.classList.add("oculto");
        }

        const menuStudent = document.getElementById("menu-opciones-flotante-student");
        const btnStudent = e.target.closest('[onclick*="toggleOpcionesMenuStudent"]');
        if (menuStudent && !btnStudent && !menuStudent.contains(e.target)) {
            menuStudent.classList.add("oculto");
        }
    });

    // 4. Procesar Login Administrativo
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const usernameInput = (document.getElementById("username")?.value || "").trim();
            const passwordInput = (document.getElementById("password")?.value || "").trim();

            const usuarioValido = "LICC";
            const correoValido = "LICC@gmail.com";

            const userMatches = (usernameInput.toLowerCase() === usuarioValido.toLowerCase()) ||
                (usernameInput.toLowerCase() === correoValido.toLowerCase()) ||
                (usernameInput.toLowerCase() === "admin");

            const savedPassword = localStorage.getItem("passwordValida");
            const defaultPassword = (savedPassword && savedPassword.trim() !== "") ? savedPassword : "1a2b3c4d5e";

            const passMatches = (passwordInput === defaultPassword) || (!savedPassword && passwordInput === "12345");

            if (userMatches && passMatches) {
                if (typeof app !== "undefined" && app.navigate) {
                    app.navigate("view-admin");
                }
                loginForm.reset();
            } else {
                alert("Correo/Usuario o contraseña incorrectos.");
            }
        });
    }
});