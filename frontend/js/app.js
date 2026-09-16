let map;
let marker;
const API_URL = '../backend/backend.php';

const calles = [
    { nombre: "Av. De La Cultura", lat: -13.531, lng: -71.935, main: true, zona: "Centro" },
    { nombre: "Vía Expresa", lat: -13.535, lng: -71.930, main: true, zona: "Sur" },
    { nombre: "Av. Tupac Amaru", lat: -13.528, lng: -71.940, main: true, zona: "Norte" },
    { nombre: "Calle Diego de Almagro", lat: -13.533, lng: -71.938, main: false, zona: "Centro" },
    { nombre: "Calle Los Pinos", lat: -13.530, lng: -71.932, main: false, zona: "Norte" },
    { nombre: "Av. Evitamiento", lat: -13.540, lng: -71.920, main: true, zona: "Sur" },
    { nombre: "Calle Las Joyas", lat: -13.532, lng: -71.934, main: false, zona: "Este" },
    { nombre: "Prolongación Av. De La Cultura", lat: -13.534, lng: -71.928, main: true, zona: "Este" },
    { nombre: "Calle San Juan", lat: -13.529, lng: -71.937, main: false, zona: "Norte" },
    { nombre: "Jr. Los Libertadores", lat: -13.536, lng: -71.933, main: false, zona: "Sur" }
];

const DEFAULT_INCIDENT_SIZES = ['Pequeño','Mediano','Enorme','Suelo inestable'];
let incidentTypes = ['Bache / hueco','Hundimiento de calzada','Pavimento deteriorado','Suelo inestable'];
let pendingPhotoData = null;

function escapeHtml(v){ return $('<div>').text(v ?? '').html(); }
function applyAppearance(){
    // Versión de apariencia final: Arial 11 px como configuración inicial.
    // Se conserva cualquier cambio que el usuario haga desde Ajustes.
    if(localStorage.getItem('sinbaches_appearance_version') !== '3'){
        localStorage.setItem('sinbaches_font','Arial,sans-serif');
        localStorage.setItem('sinbaches_font_size','14px');
        localStorage.setItem('sinbaches_appearance_version','3');
    }
    const font = localStorage.getItem('sinbaches_font') || 'Arial,sans-serif';
    const size = localStorage.getItem('sinbaches_font_size') || '14px';
    document.documentElement.style.setProperty('--app-font', font);
    document.documentElement.style.setProperty('--app-font-size', size);
    $('#fontFamilySetting').val(font); $('#fontSizeSetting').val(size);
}
function populateIncidentOptions(types){
    incidentTypes = Array.isArray(types) && types.length ? types : incidentTypes;
    $('#incident_size').empty().append(DEFAULT_INCIDENT_SIZES.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join(''));
    $('#incident_type').empty().append(incidentTypes.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join(''));
}
function renderIncidentTypes(){
    const box=$('#incidentTypesList').empty();
    incidentTypes.forEach((x,i)=>box.append(`<div class="incident-type-row"><span><i class="fa-solid fa-tag"></i> ${escapeHtml(x)}</span><button type="button" class="btn btn-sm btn-outline-danger btn-del-incident" data-index="${i}"><i class="fa-solid fa-trash"></i></button></div>`));
}
function resizePhoto(file, cb){
    if(!file){ cb(null); return; }
    const reader=new FileReader();
    reader.onload=function(e){ const img=new Image(); img.onload=function(){ const maxW=320,maxH=240,scale=Math.min(maxW/img.width,maxH/img.height,1); const c=document.createElement('canvas'); c.width=Math.round(img.width*scale); c.height=Math.round(img.height*scale); c.getContext('2d').drawImage(img,0,0,c.width,c.height); cb(c.toDataURL('image/jpeg',0.65)); }; img.src=e.target.result; };
    reader.readAsDataURL(file);
}

$(document).ready(function() {
    initMap();
    initCalles();
    loadData();
    applyAppearance();
    populateIncidentOptions(incidentTypes);

    // Actualizar valores cuando cambia la calle
    $('#street').change(function() {
        const opt = $(this).find('option:selected');
        $('#is_main_avenue').val(opt.data('main'));
        
        map.flyTo([opt.data('lat'), opt.data('lng')], 16);
        if(marker) map.removeLayer(marker);
        marker = L.marker([opt.data('lat'), opt.data('lng')]).addTo(map).bindPopup("<b>" + $(this).val() + "</b>").openPopup();
    });

    // Simular reporte (agitar celular)
    $('#reportForm').submit(function(e) {
        if(e) e.preventDefault();
        const btn = $('#btnShock');
        btn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i>');

        const opt = $('#street').find('option:selected');

        $.post(API_URL, {
            action: 'report_bache',
            bus_id: $('#bus_id').val(),
            street: $('#street').val(),
            is_main_avenue: $('#is_main_avenue').val(),
            zone: opt.data('zona') || 'Centro',
            lat: Number(opt.data('lat')),
            lng: Number(opt.data('lng')),
            user_type: $('#user_type').val(),
            incident_size: $('#incident_size').val(),
            incident_type: $('#incident_type').val(),
            photo: pendingPhotoData || ''
        }, function(response) {
            setTimeout(() => {
                btn.prop('disabled', false).html('<i class="fa-solid fa-house-crack"></i> ¡Aquí hay un Bache!');
                if (response.status === 'success') { pendingPhotoData=null; $('#incident_photo').val(''); $('#photoPreview').html('<span><i class="fa-regular fa-image"></i> Sin foto adjunta</span>'); loadData(); }
            }, 300);
        }, 'json');
    });

    // Pestaña Usuarios: Guardar nuevo usuario
    $('#addUserForm').submit(function(e) {
        e.preventDefault();
        $.post(API_URL, {
            action: 'add_user',
            bus_id: $('#add_bus_id').val(),
            name: $('#add_name').val(),
            dni: $('#add_dni').val(),
            plate: $('#add_plate').val(),
            route: $('#add_route').val(),
            email: $('#add_email').val(),
            phone: $('#add_phone').val()
        }, function() {
            alert("Vehículo / Conductor registrado con éxito.");
            $('#addUserForm')[0].reset();
            loadData();
        }, 'json');
    });

    $('#user_type').on('change', function(){
        const pedestrian=$(this).val()==='Peatón';
        $('#bus_id').prop('disabled',pedestrian);
        if(pedestrian) $('#bus_id').attr('data-prev-bus',$('#bus_id').val()).val('PEATON');
        else { const prev=$('#bus_id').attr('data-prev-bus'); if(prev) $('#bus_id').val(prev); }
    });

    $('#incident_photo').on('change', function(){ resizePhoto(this.files[0], function(data){ pendingPhotoData=data; $('#photoPreview').html(data ? `<img src="${data}" alt="Vista previa del bache"><span>Foto adjunta · reducida para la demo</span>` : '<span><i class="fa-regular fa-image"></i> Sin foto adjunta</span>'); }); });
    $(document).on('click','.demo-photo',function(){
        const src=$(this).data('photo'); pendingPhotoData=null;
        fetch(src).then(r=>r.blob()).then(blob=>{ const file=new File([blob],'bache_demo.svg',{type:blob.type||'image/svg+xml'}); resizePhoto(file,function(data){ pendingPhotoData=data; $('#photoPreview').html(`<img src="${data}" alt="Bache de ejemplo"><span>Foto de ejemplo adjunta</span>`); }); }).catch(()=>{ $('#photoPreview').html(`<img src="${src}" alt="Bache de ejemplo"><span>Foto de ejemplo seleccionada</span>`); });
    });

    $('#fontFamilySetting,#fontSizeSetting').on('change',function(){
        const font=$('#fontFamilySetting').val(),size=$('#fontSizeSetting').val();
        localStorage.setItem('sinbaches_font',font); localStorage.setItem('sinbaches_font_size',size); applyAppearance();
    });
    $('#btnAddIncidentType').click(function(){
        const value=$.trim($('#newIncidentType').val()); if(!value)return;
        $.post(API_URL,{action:'add_incident_type',name:value},function(r){ if(r.status==='success'){ incidentTypes=r.incident_types; populateIncidentOptions(incidentTypes); renderIncidentTypes(); $('#newIncidentType').val(''); } },'json');
    });
    $(document).on('click','.btn-del-incident',function(){
        const idx=Number($(this).data('index')); const value=incidentTypes[idx];
        if(!confirm(`¿Eliminar el tipo de incidente "${value}"?`))return;
        $.post(API_URL,{action:'delete_incident_type',name:value},function(r){ if(r.status==='success'){ incidentTypes=r.incident_types; populateIncidentOptions(incidentTypes); renderIncidentTypes(); } },'json');
    });

    $('#btnReset').click(function(){
        if(confirm("¿Seguro de borrar tickets y blockchain?")) {
            $.post(API_URL, { action: 'reset' }, function() { loadData(); });
        }
    });

    // Botón Solucionar
    $(document).on('click', '.btn-resolve', function(e, bypassConfirm) {
        const streetKey = $(this).data('key');
        if(bypassConfirm || confirm("¿Bache arreglado?")) {
            $.post(API_URL, { action: 'resolve_ticket', street_key: streetKey }, function(res) {
                if (res.status === 'success') loadData();
            }, 'json');
        }
    });

    // =============== SIMULADOR AUTOMÁTICO ===============
    let simIntervalId = null;
    let simTimerId = null;
    let timeLeft = 0;

    $('#btnStartSim').click(function() {
        const intervalSec = parseFloat($('#sim_interval').val()) || 2;
        timeLeft = parseInt($('#sim_duration').val()) || 60;
        
        $('#btnStartSim, #sim_duration, #sim_interval').prop('disabled', true);
        $('#btnStopSim').prop('disabled', false);
        
        updateTimerDisplay();

        // Cuenta regresiva
        simTimerId = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            if (timeLeft <= 0) {
                $('#btnStopSim').click();
            }
        }, 1000);

        // Envío de reportes
        simIntervalId = setInterval(() => {
            const buses = $('#bus_id option');
            $('#bus_id').prop('selectedIndex', Math.floor(Math.random() * buses.length));

            const streets = $('#street option');
            $('#street').prop('selectedIndex', Math.floor(Math.random() * streets.length)).trigger('change');

            $('#reportForm').submit();

            // Interacción aleatoria
            setTimeout(() => {
                const resolveBtns = $('.btn-resolve');
                if (resolveBtns.length > 0 && Math.random() > 0.7) {
                    resolveBtns.eq(Math.floor(Math.random() * resolveBtns.length)).trigger('click', [true]);
                }
            }, 800);
        }, intervalSec * 1000);
    });

    $('#btnStopSim').click(function() {
        clearInterval(simIntervalId);
        clearInterval(simTimerId);
        $('#btnStartSim, #sim_duration, #sim_interval').prop('disabled', false);
        $('#btnStopSim').prop('disabled', true);
    });

    function updateTimerDisplay() {
        const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const s = (timeLeft % 60).toString().padStart(2, '0');
        $('#countdown_timer').text(`${m}:${s}`);
    }

    // =============== REPORTES E IA ===============
    $('a[data-bs-toggle="tab"]').on('shown.bs.tab', function (e) {
        if (e.target.id === 'nav-reports-tab') {
            loadStats();
        }
    });

    $('#btnFilter').click(loadStats);

    $('#btnExportCSV').click(function() {
        window.location.href = API_URL + '?action=export_csv';
    });

    $('#btnExportPDF').click(function() {
        window.print();
    });

});

function initMap() {
    map = L.map('map').setView([-13.5303, -71.9392], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 19
    }).addTo(map);
}

function initCalles() {
    const sel = $('#street');
    sel.empty();
    calles.forEach(c => {
        sel.append(`<option value="${c.nombre || c.margin}" data-main="${c.main}" data-lat="${c.lat}" data-lng="${c.lng}" data-zona="${c.zona}">${c.nombre || c.margin}</option>`);
    });
}

window.__aiTickets = {};
window.__aiCurrentKey = null;

function updateAiLive(tickets){
    window.__aiTickets=tickets||{};
    const entries=Object.entries(window.__aiTickets).sort((a,b)=>new Date(b[1]?.created_at||0)-new Date(a[1]?.created_at||0)).slice(0,5);
    if(!entries.length){
        window.__aiCurrentKey=null; $('#ai-ticket-name').text('Esperando 5 reportes...'); $('#ai-priority-preview,#ai-reports-preview').text('—');
        $('#ai-coordinate-preview').html('<i class="fa-solid fa-location-dot"></i> Coordenadas: —'); $('#ai-status').text('ESPERANDO TICKET').removeClass().addClass('ai-status ai-status-ready');
        $('#aiEmptyState').removeClass('d-none'); $('#aiResultCard').addClass('d-none'); return;
    }
    window.__aiCurrentKey=entries[0][0]; const last=entries[0][1];
    $('#ai-ticket-name').text(last.street||'Ticket'); $('#ai-priority-preview').text(last.priority||'Normal'); $('#ai-reports-preview').text((last.report_count||0)+' reportes');
    const lat=last.lat??last.latitude??'—',lng=last.lng??last.lon??last.longitude??'—'; $('#ai-coordinate-preview').html(`<i class="fa-solid fa-location-dot"></i> Coordenadas: ${lat}, ${lng}`);
    $('#aiEmptyState').addClass('d-none'); $('#aiResultCard').removeClass('d-none'); $('#ai-status').text('TICKETS DISPONIBLES').removeClass().addClass('ai-status ai-status-live');
    const citizen=$('#aiCitizenList').empty(), municipal=$('#aiMunicipalList').empty();
    entries.forEach(([key,t],i)=>{
        const tlat=t.lat??t.latitude??'—',tlng=t.lng??t.lon??t.longitude??'—';
        const pub=t.ai_public||t.ai_response||'Pendiente de generar explicación ciudadana.';
        const internal=t.ai_internal||`Ticket ${t.priority||'Normal'}: ${t.street||'Sin calle'}; ${t.report_count||0} reportes; ${t.incident_size||'Tamaño no indicado'}; ${t.incident_type||'Incidente no indicado'}; coordenadas ${tlat}, ${tlng}. Estado: ${t.status||'Abierto'}.`;
        const priorityClass=String(t.priority||'Normal').toLowerCase().includes('urg')||String(t.priority||'').toLowerCase().includes('grave')?'priority-urgente':'priority-normal';
        const common=`<div class="ai-ticket-item ${priorityClass}${i===0?' ai-ticket-active':''}"><div class="ai-ticket-top"><span class="ai-ticket-index">${i+1}</span><strong>${escapeHtml(t.street||'Sin calle')}</strong><span class="ai-mini-badge">${escapeHtml(t.priority||'Normal')}</span></div><div class="ai-ticket-data">${t.report_count||0} reportes · ${escapeHtml(t.zone||'San Sebastián')} · ${escapeHtml(t.incident_size||'—')} · ${escapeHtml(t.incident_type||'—')} · ${tlat}, ${tlng}</div>`;
        citizen.append(common+`<div class="ai-ticket-message">${escapeHtml(pub)}</div></div>`);
        municipal.append(common+`<div class="ai-ticket-message internal-message">${escapeHtml(internal)}</div></div>`);
    });
    updateWhatsApp(last.ai_public||last.ai_response||'La IA está lista para generar la explicación.',last);
}
function updateWhatsApp(message,ticket){
    const text=(message||'').replace(/\*\*/g,'');
    const url='https://wa.me/?text='+encodeURIComponent(text+'\n\nUbicación: '+(ticket?.street||'—')+'\nCoordenadas: '+(ticket?.lat??'—')+', '+(ticket?.lng??'—'));
    $('#btn-whatsapp-ia').attr('href',url);
}
function generateAiLive(){
    const key=window.__aiCurrentKey,ticket=window.__aiTickets[key]; if(!key||!ticket)return;
    const btn=$('#btn-generar-ia'); btn.prop('disabled',true).html('<i class="fa-solid fa-spinner fa-spin"></i> GENERANDO...'); $('#ai-status').text('GENERANDO...');
    $.post(API_URL,{action:'generate_ai',street_key:key},function(r){
        if(r.status==='success'){ticket.ai_response=r.ai_message; updateAiLive(window.__aiTickets); $('#ai-status').text('GENERADO');}
    },'json').fail(function(){ ticket.ai_response=`Comunicación vecinal: se ha reportado un bache en ${ticket.street}. Se registraron ${ticket.report_count||0} reportes. Prioridad: ${ticket.priority||'Normal'}.`; updateAiLive(window.__aiTickets); $('#ai-status').text('GENERADO');
    }).always(function(){btn.prop('disabled',false).html('<i class="fa-solid fa-wand-magic-sparkles"></i> GENERAR / REGENERAR ÚLTIMO');});
}

function loadData() {
    $.get(API_URL + '?action=get_data', function(data) {
        updateAiLive(data.tickets || {});
        if(Array.isArray(data.incident_types)){ incidentTypes=data.incident_types; populateIncidentOptions(incidentTypes); renderIncidentTypes(); }
        // 20 usuarios originales: solo se leen, nunca se reemplazan.
        const busSelect=$('#bus_id'), usersTable=$('#usersTableBody'), prevBus=busSelect.val();
        busSelect.empty(); usersTable.empty();
        if(Array.isArray(data.users)){
            data.users.forEach(u=>{
                busSelect.append(new Option(`${u.bus_id} - ${u.name} (${u.route})`,u.bus_id));
                usersTable.append(`<tr><td>${u.bus_id}</td><td>${u.name}</td><td>${u.route}</td><td>${u.plate}</td></tr>`);
            });
            if(prevBus && data.users.some(u=>u.bus_id===prevBus)) busSelect.val(prevBus);
            $('#userCountBadge').text(`${data.users.length} usuarios`);
        }

        // SMART CONTRACTS: renderizar siempre los tickets devueltos por backend.
        const tbody=$('#ticketsTableBody'); tbody.empty();
        const tickets=data.tickets || {};
        const ticketEntries=Object.entries(tickets).sort((a,b)=>new Date(b[1].created_at||0)-new Date(a[1].created_at||0));
        if(!ticketEntries.length){
            tbody.html('<tr><td colspan="5" class="text-center text-muted py-4"><i class="fa-solid fa-hourglass-half"></i> Aún no hay Tickets. Se crea automáticamente al alcanzar 5 reportes en la misma calle.</td></tr>');
        } else {
            ticketEntries.forEach(([key,ticket])=>{
                const pClass=ticket.priority==='Urgente'?'priority-urgente':'priority-normal';
                let statusBadge='<span class="badge bg-secondary">'+(ticket.status||'Abierto')+'</span>';
                if(ticket.status==='Abierto') statusBadge='<span class="badge bg-danger">Abierto</span>';
                else if(ticket.status==='Revisando reparacion') statusBadge='<span class="badge bg-warning text-dark">Revisando reparación</span>';
                else if(ticket.status==='Solucionado') statusBadge='<span class="badge bg-success">Solucionado</span>';
                else if(ticket.status==='Solucionado Permanente') statusBadge='<span class="badge bg-primary">Solucionado Permanente</span>';
                let action='';
                if(ticket.status==='Abierto') action=`<button class="btn btn-sm btn-outline-success btn-resolve" data-key="${key}" title="Marcar como solucionado"><i class="fa-solid fa-check"></i></button>`;
                else if(ticket.status==='Revisando reparacion') action=`<button class="btn btn-sm btn-outline-success btn-resolve" data-key="${key}" title="Confirmar reparación"><i class="fa-solid fa-check-double"></i></button>`;
                const tlat=ticket.lat ?? ticket.latitude ?? '—'; const tlng=ticket.lng ?? ticket.lon ?? ticket.longitude ?? '—';
            tbody.append(`<tr><td style="font-size:.85em">${ticket.street}</td><td><strong>${ticket.report_count||0}</strong> / 5</td><td class="${pClass}">${ticket.priority||'Normal'}</td><td>${statusBadge}</td><td class="coord-cell">${tlat}, ${tlng}</td><td>${action}</td></tr>`);
            });
        }

        const ticketCount = ticketEntries.length;
        if(ticketCount){
            $('#ticketStatusSummary').html(`<strong>${ticketCount} Ticket(s) activo(s)</strong> — Smart Contract funcionando y registrados automáticamente.`);
        } else {
            $('#ticketStatusSummary').text('Smart Contract listo: se crea un Ticket automáticamente al llegar a 5 reportes en la misma calle.');
        }

        updateAiLive(tickets);

        // Blockchain Log
        const logContainer=$('#blockchainLog'); logContainer.empty();
        (data.blockchain||[]).slice().reverse().forEach(log=>{
            let icon='fa-link',color='text-light';
            if(log.event.includes('Bache reportado por el bus')){icon='fa-road';color='text-danger';}
            if(log.event.includes('Smart Contract')){icon='fa-file-contract';color='text-warning';}
            if(log.event.includes('IA Generativa')){icon='fa-robot';color='text-info';}
            if(log.event.includes('solucionó') || log.event.includes('Solucionado')){icon='fa-check';color='text-success';}
            logContainer.append(`<div class="log-entry"><span class="log-time">[${String(log.timestamp||'').substr(11,8)}]</span><span class="${color}"><i class="fa-solid ${icon}"></i> ${log.event}</span></div>`);
        });
    },'json').fail(function(xhr){
        console.error('Error cargando datos:',xhr.responseText);
        $('#ticketsTableBody').html('<tr><td colspan="5" class="text-center text-danger">No se pudo cargar Smart Contracts.</td></tr>');
    });
}


function formatReportDate(v){ if(!v)return '—'; const d=new Date(v+'T00:00:00'); return isNaN(d.getTime())?v:d.toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'}); }
function updateReportMeta(data){
    const box=$('#topReporters');
    if(data.date_min&&data.date_max) $('#reportDateRange').html(`<i class="fa-regular fa-calendar-days"></i> Reportes generados del <strong>${formatReportDate(data.date_min)}</strong> al <strong>${formatReportDate(data.date_max)}</strong> · ${data.report_count||0} reportes`);
    else $('#reportDateRange').html('<i class="fa-regular fa-calendar-days"></i> No hay reportes generados en el período seleccionado.');
    const counts={}; (data.reports||[]).forEach(r=>{const id=r.bus_id||r.user_id||''; if(id)counts[id]=(counts[id]||0)+1;});
    const list=(data.users||[]).map(u=>{const id=u.bus_id||u.id||'';return {id,name:u.name||u.nombre||id||'Usuario',count:counts[id]||0};}).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'es')).slice(0,5);
    if(list.length) box.html(list.map((x,i)=>`<div class="reporter-row"><span class="reporter-rank">${i+1}</span><span class="reporter-name">${x.name}<small class="reporter-id">${x.id}</small></span><span class="reporter-count">${x.count} ${x.count===1?'reporte':'reportes'}</span></div>`).join(''));
    else box.html('<div class="reporter-empty">Aún no hay usuarios registrados.</div>');
}
function loadStats(){
    const start=$('#filter_start').val(),end=$('#filter_end').val();
    $.get(`${API_URL}?action=get_stats&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,function(data){
        if(data.status!=='success')return; updateReportMeta(data);
        $('#stat_total').text(data.report_count||0); $('#stat_resolved').text(data.resolved||0); $('#stat_eff').text((data.efficiency||0)+'%');
        const z=$('#stats_zones').empty(); Object.entries(data.by_zone||{}).forEach(([k,v])=>z.append(`<li class="list-group-item bg-transparent text-light border-secondary d-flex justify-content-between"><span>${k}</span><span class="badge bg-primary rounded-pill">${v}</span></li>`));
        const st=$('#stats_streets').empty(); (data.top_streets||[]).forEach((x,i)=>st.append(`<li class="list-group-item bg-transparent text-light border-secondary d-flex justify-content-between align-items-center"><span class="small"><strong class="street-rank">${i+1}.</strong> ${x.street}<br><small class="street-coord"><i class="fa-solid fa-location-dot"></i> ${x.lat}, ${x.lng}</small></span><span class="badge bg-warning text-dark rounded-pill">${x.count} reportes</span></li>`));
        if(!(data.top_streets||[]).length)st.html('<li class="list-group-item bg-transparent text-light">Aún no hay reportes en este período.</li>');
    },'json').fail(()=>$('#reportDateRange').html('<i class="fa-solid fa-triangle-exclamation"></i> No se pudo cargar el historial de reportes.'));
}
