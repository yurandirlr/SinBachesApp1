<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');

$db_file = __DIR__ . '/database.json';

// Semilla inicial si no existe DB
if (!file_exists($db_file)) {
    $initial_users = [];
    for($i=1; $i<=20; $i++) {
        $rutas = ["E.T. El León", "E.T. Batman", "E.T. El Zorro", "E.T. Imperial", "E.T. Chaska"];
        $initial_users[] = [
            "bus_id" => "Bus #".(100+$i),
            "name" => "Conductor Piloto $i",
            "dni" => "700000".str_pad($i, 2, '0', STR_PAD_LEFT),
            "plate" => "X1".chr(65+($i%26))."-".rand(100,999),
            "route" => $rutas[array_rand($rutas)],
            "email" => "piloto$i@ruta.com",
            "phone" => "9".rand(10000000,99999999)
        ];
    }
    
    file_put_contents($db_file, json_encode([
        "users" => $initial_users,
        "reports" => [],
        "tickets" => [], 
        "blockchain" => [],
        "incident_types" => ["Bache / hueco","Hundimiento de calzada","Pavimento deteriorado","Suelo inestable"]
    ]));
}

function read_db() {
    global $db_file;
    $data = json_decode(file_get_contents($db_file), true);
    if (!is_array($data)) $data = [];
    if (!isset($data['incident_types']) || !is_array($data['incident_types'])) {
        $data['incident_types'] = ['Bache / hueco','Hundimiento de calzada','Pavimento deteriorado','Suelo inestable'];
    }
    return $data;
}

function write_db($data) {
    global $db_file;
    file_put_contents($db_file, json_encode($data, JSON_PRETTY_PRINT));
}

function add_to_blockchain(&$db, $message) {
    $db['blockchain'][] = [
        "timestamp" => date("Y-m-d H:i:s"),
        "event" => $message
    ];
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';

if ($action === 'get_data') {
    echo json_encode(read_db());
    exit;
}

if ($action === 'add_user') {
    $db = read_db();
    $db['users'][] = [
        "bus_id" => $_POST['bus_id'] ?? '',
        "name" => $_POST['name'] ?? '',
        "dni" => $_POST['dni'] ?? '',
        "plate" => $_POST['plate'] ?? '',
        "route" => $_POST['route'] ?? '',
        "email" => $_POST['email'] ?? '',
        "phone" => $_POST['phone'] ?? ''
    ];
    write_db($db);
    echo json_encode(["status" => "success", "message" => "Vehículo registrado correctamente", "user_count" => count($db['users'])]);
    exit;
}

if ($action === 'report_bache') {
    $bus_id = $_POST['bus_id'] ?? 'Desconocido';
    $street = trim($_POST['street'] ?? '');
    $is_main_avenue = isset($_POST['is_main_avenue']) && $_POST['is_main_avenue'] === 'true';
    $zone = $_POST['zone'] ?? 'Centro';
    $lat = isset($_POST['lat']) ? (float)$_POST['lat'] : null;
    $lng = isset($_POST['lng']) ? (float)$_POST['lng'] : null;

    if (empty($street)) {
        echo json_encode(["status" => "error", "message" => "La calle es requerida"]);
        exit;
    }

    $db = read_db();
    $timestamp = date("Y-m-d H:i:s");
    $street_key = md5($street);
    
    // Si ya está "Solucionado Permanente", no registramos más baches
    if (isset($db['tickets'][$street_key]) && $db['tickets'][$street_key]['status'] === 'Solucionado Permanente') {
        echo json_encode(["status" => "success", "message" => "Ignorado, solucionado permanentemente"]);
        exit;
    }

    $db['reports'][] = [
        "bus_id" => $bus_id,
        "user_type" => $_POST['user_type'] ?? 'Conductor',
        "street" => $street,
        "zone" => $zone,
        "is_main_avenue" => $is_main_avenue,
        "incident_size" => $_POST['incident_size'] ?? 'Mediano',
        "incident_type" => $_POST['incident_type'] ?? 'Bache / hueco',
        "photo" => $_POST['photo'] ?? '',
        "lat" => $lat,
        "lng" => $lng,
        "timestamp" => $timestamp
    ];
    
    add_to_blockchain($db, "Bache reportado por el bus: $bus_id en $street ($zone).");

    $report_count = 0;
    foreach ($db['reports'] as $report) {
        if ($report['street'] === $street) $report_count++;
    }

    $ticket_exists = isset($db['tickets'][$street_key]);

    if (!$ticket_exists && $report_count >= 5) {
        $priority = $is_main_avenue ? "Urgente" : "Normal";
        $db['tickets'][$street_key] = [
            "street" => $street,
            "zone" => $zone,
            "report_count" => $report_count,
            "priority" => $priority,
            "status" => "Abierto",
            "ai_response" => null,
            "ai_public" => null,
            "ai_internal" => null,
            "incident_size" => $_POST['incident_size'] ?? 'Mediano',
            "incident_type" => $_POST['incident_type'] ?? 'Bache / hueco',
            "lat" => $lat,
            "lng" => $lng,
            "created_at" => $timestamp,
            "resolved_at" => null,
            "post_reports" => 0
        ];
        add_to_blockchain($db, "⚙️ Smart Contract: 5 reportes en $street. Ticket $priority creado.");
        
        // IA Automática al crear ticket
        $size = $_POST['incident_size'] ?? 'Mediano';
        $type = $_POST['incident_type'] ?? 'Bache / hueco';
        $publicTemplates = [
            "Se confirmó un incidente vial tipo $type, de tamaño $size, en $street. Se registraron $report_count reportes y se generó un ticket de atención municipal.",
            "Atención ciudadanía: el sistema confirmó un $type de tamaño $size en $street. El caso quedó registrado para atención municipal."
        ];
        $public = $publicTemplates[array_rand($publicTemplates)];
        $internal = "Ticket municipal: $street | Prioridad: $priority | Reportes: $report_count | Incidente: $type | Tamaño: $size | Zona: $zone | Coordenadas: $lat, $lng | Estado: Abierto.";
        $db['tickets'][$street_key]['ai_response'] = $public;
        $db['tickets'][$street_key]['ai_public'] = $public;
        $db['tickets'][$street_key]['ai_internal'] = $internal;
        
    } else if ($ticket_exists) {
        // Smart Contract 2: verifica reportes posteriores a una reparación.
        $ticket = &$db['tickets'][$street_key];
        
        if ($ticket['status'] === 'Solucionado') {
            $ticket['status'] = 'Revisando reparacion';
            $ticket['post_reports'] = 1;
            add_to_blockchain($db, "⚙️ Smart Contract: Reporte post-reparación en $street. Estado cambiado a 'Revisando reparacion'.");
        } else if ($ticket['status'] === 'Revisando reparacion') {
            $ticket['post_reports']++;
            if ($ticket['post_reports'] >= 3) {
                $ticket['status'] = 'Solucionado Permanente';
                add_to_blockchain($db, "⚙️ Smart Contract: 3 reportes verificados en $street. Asfalto consolidado. 'Solucionado Permanente'.");
            }
        } else if ($ticket['status'] === 'Abierto') {
            $ticket['report_count'] = $report_count;
        }
    }

    write_db($db);
    echo json_encode(["status" => "success"]);
    exit;
}

if ($action === 'generate_ai') {
    $street_key = $_POST['street_key'] ?? '';
    $db = read_db();
    
    if (isset($db['tickets'][$street_key])) {
        $street = $db['tickets'][$street_key]['street'];
        $t = $db['tickets'][$street_key];
        $size = $t['incident_size'] ?? 'Mediano'; $type = $t['incident_type'] ?? 'Bache / hueco';
        $ai_message = "Se confirmó un incidente vial tipo $type, de tamaño $size, en $street. Se registraron " . ($t['report_count'] ?? 0) . " reportes y se generó un ticket de atención municipal.";
        $ai_internal = "Ticket municipal: $street | Prioridad: " . ($t['priority'] ?? 'Normal') . " | Reportes: " . ($t['report_count'] ?? 0) . " | Incidente: $type | Tamaño: $size | Zona: " . ($t['zone'] ?? 'Centro') . " | Coordenadas: " . ($t['lat'] ?? '—') . ", " . ($t['lng'] ?? '—') . " | Estado: " . ($t['status'] ?? 'Abierto') . ".";
        $db['tickets'][$street_key]['ai_response'] = $ai_message;
        $db['tickets'][$street_key]['ai_public'] = $ai_message;
        $db['tickets'][$street_key]['ai_internal'] = $ai_internal;
        add_to_blockchain($db, "🧠 IA Generativa: explicación generada para $street.");
        write_db($db);
        echo json_encode(["status" => "success", "ai_message" => $ai_message, "ai_public" => $ai_message, "ai_internal" => $ai_internal]);
    } else {
        echo json_encode(["status" => "error", "message" => "Ticket no encontrado"]);
    }
    exit;
}

if ($action === 'add_incident_type') {
    $db=read_db(); $name=trim($_POST['name']??'');
    if($name===''){ echo json_encode(["status"=>"error","message"=>"Nombre requerido"]); exit; }
    if(!in_array($name,$db['incident_types'],true)) $db['incident_types'][]=$name;
    write_db($db); echo json_encode(["status"=>"success","incident_types"=>$db['incident_types']]); exit;
}

if ($action === 'delete_incident_type') {
    $db=read_db(); $name=trim($_POST['name']??'');
    $db['incident_types']=array_values(array_filter($db['incident_types'],fn($x)=>$x!==$name));
    if(count($db['incident_types'])===0) $db['incident_types']=['Bache / hueco'];
    write_db($db); echo json_encode(["status"=>"success","incident_types"=>$db['incident_types']]); exit;
}

if ($action === 'resolve_ticket') {
    $street_key = $_POST['street_key'] ?? '';
    $db = read_db();
    
    if (isset($db['tickets'][$street_key])) {
        $street = $db['tickets'][$street_key]['street'];
        $db['tickets'][$street_key]['status'] = 'Solucionado';
        $db['tickets'][$street_key]['resolved_at'] = date("Y-m-d H:i:s");
        add_to_blockchain($db, "✅ Cuadrilla solucionó el bache en $street.");
        write_db($db);
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["status" => "error"]);
    }
    exit;
}

if ($action === 'get_stats') {
    $db = read_db();
    $start = $_GET['start'] ?? ''; $end = $_GET['end'] ?? '';
    $filtered=[]; $by_zone=[]; $by_street=[]; $locations=[];
    foreach (($db['reports'] ?? []) as $r) {
        $date=substr($r['timestamp']??'',0,10); if($start&&$date<$start)continue; if($end&&$date>$end)continue;
        $filtered[]=$r; $z=$r['zone']??'Centro'; $by_zone[$z]=($by_zone[$z]??0)+1; $st=$r['street']??'Sin calle'; $by_street[$st]=($by_street[$st]??0)+1;
        if(!isset($locations[$st]))$locations[$st]=['lat'=>$r['lat']??'—','lng'=>$r['lng']??'—'];
    }
    arsort($by_street); $top=[]; foreach($by_street as $st=>$count){$top[]=['street'=>$st,'count'=>$count,'lat'=>$locations[$st]['lat']??'—','lng'=>$locations[$st]['lng']??'—']; if(count($top)>=5)break;}
    $resolved=0; $ticket_total=0; foreach(($db['tickets']??[]) as $t){$d=substr($t['created_at']??'',0,10); if($start&&$d<$start)continue; if($end&&$d>$end)continue; $ticket_total++; if(($t['status']??'')==='Solucionado'||($t['status']??'')==='Solucionado Permanente')$resolved++;}
    $dates=array_values(array_filter(array_map(fn($r)=>substr($r['timestamp']??'',0,10),$filtered))); sort($dates);
    echo json_encode(['status'=>'success','report_count'=>count($filtered),'total'=>$ticket_total,'resolved'=>$resolved,'efficiency'=>$ticket_total?round(($resolved/$ticket_total)*100):0,'by_zone'=>$by_zone,'top_streets'=>$top,'reports'=>$filtered,'users'=>$db['users']??[],'date_min'=>$dates[0]??null,'date_max'=>$dates[count($dates)-1]??null,'incident_types'=>$db['incident_types']??[]]); exit;
}

if ($action === 'export_csv') {
    $db = read_db();
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="reporte_sinbaches.csv"');
    
    $output = fopen('php://output', 'w');
    fputcsv($output, ['Calle', 'Zona', 'Reportes', 'Prioridad', 'Estado', 'Fecha Creacion', 'Fecha Resolucion']);
    
    foreach ($db['tickets'] as $ticket) {
        fputcsv($output, [
            $ticket['street'],
            $ticket['zone'] ?? 'Centro',
            $ticket['report_count'],
            $ticket['priority'],
            $ticket['status'],
            $ticket['created_at'],
            $ticket['resolved_at'] ?? 'Pendiente'
        ]);
    }
    fclose($output);
    exit;
}

if ($action === 'reset') {
    $db = read_db();
    $db['reports'] = [];
    $db['tickets'] = [];
    $db['blockchain'] = [];
    write_db($db);
    echo json_encode(["status" => "success"]);
    exit;
}

echo json_encode(["status" => "error", "message" => "Acción inválida"]);
?>
