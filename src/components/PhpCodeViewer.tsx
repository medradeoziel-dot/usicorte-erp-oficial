import React, { useState } from 'react';
import { Copy, Check, FileCode, Database, Terminal } from 'lucide-react';

export default function PhpCodeViewer() {
  const [copiedTab, setCopiedTab] = useState<'php' | 'vendas' | 'sql' | null>(null);
  const [activeFile, setActiveFile] = useState<'php' | 'vendas' | 'sql'>('php');

  const vendasPhpCode = `<?php
/**
 * SISTEMA DE VENDAS E ORÇAMENTOS - PHP + MYSQL (USICORTE)
 * 
 * Módulo completo com seleção de cliente, cálculo de constantes, 
 * medidas metalúrgicas, lançamento de itens e cálculo de subtotais e totais.
 */

$db_host = 'localhost';
$db_name = 'cadastro_clientes';
$db_user = 'root';
$db_pass = '';

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die("Erro ao conectar ao banco de dados: " . $e->getMessage());
}

// Salvar Orçamento Completo (Header + Itens)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'salvar_orcamento') {
    $quote_number = $_POST['quote_number'] ?? 'COT-' . date('Y') . '-' . rand(1000, 9999);
    $client_name = $_POST['client_name'] ?? 'Cliente Balcão';
    $client_doc = $_POST['client_doc'] ?? '';
    $contact = $_POST['contact'] ?? '';
    $quote_date = $_POST['quote_date'] ?? date('Y-m-d');
    $validity_days = (int)($_POST['validity_days'] ?? 10);
    $payment_terms = $_POST['payment_terms'] ?? 'À Vista';
    $discount = (float)($_POST['discount'] ?? 0);
    $shipping = (float)($_POST['shipping'] ?? 0);
    $subtotal_total = (float)($_POST['subtotal_total'] ?? 0);
    $grand_total = (float)($_POST['grand_total'] ?? 0);
    $observations = $_POST['observations'] ?? '';
    $items = json_decode($_POST['items_json'] ?? '[]', true);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO orcamentos 
            (quote_number, client_name, client_document, contact_person, quote_date, validity_days, payment_terms, discount, shipping, subtotal_total, grand_total, observations) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$quote_number, $client_name, $client_doc, $contact, $quote_date, $validity_days, $payment_terms, $discount, $shipping, $subtotal_total, $grand_total, $observations]);
        $orcamento_id = $pdo->lastInsertId();

        $stmtItem = $pdo->prepare("INSERT INTO orcamento_itens 
            (orcamento_id, description, constant, measure, diameter, width_length, unit_price, quantity, subtotal, notes) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

        foreach ($items as $it) {
            $stmtItem->execute([
                $orcamento_id,
                $it['description'] ?? '',
                $it['constant'] ?? '1.0',
                $it['measure'] ?? '',
                $it['diameter'] ?? '',
                $it['widthLength'] ?? '',
                (float)($it['unitPrice'] ?? 0),
                (float)($it['quantity'] ?? 1),
                (float)($it['subtotal'] ?? 0),
                $it['notes'] ?? ''
            ]);
        }

        $pdo->commit();
        $mensagem_sucesso = "Orçamento $quote_number gravado com sucesso!";
    } catch (Exception $e) {
        $pdo->rollBack();
        $mensagem_erro = "Erro ao salvar orçamento: " . $e->getMessage();
    }
}

// Buscar clientes cadastrados para o dropdown
$clientes = $pdo->query("SELECT id, name, fantasy_name, document, phone, email, city, state FROM clientes ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);

// Buscar orçamentos salvos
$orcamentos = $pdo->query("SELECT * FROM orcamentos ORDER BY id DESC LIMIT 20")->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UsiCorte - Orçamentos e Vendas Industrial</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen p-4 sm:p-8 font-sans">
    <div class="max-w-7xl mx-auto space-y-6">
        <!-- Top Branding -->
        <div class="bg-slate-900 text-white p-6 rounded-2xl flex justify-between items-center shadow-lg">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-xl">UC</div>
                <div>
                    <h1 class="text-xl font-bold">UsiCorte • Módulo de Vendas e Orçamentos</h1>
                    <p class="text-xs text-slate-400">Sistema em PHP + MySQL com Cálculo Automático de Medidas e Constantes</p>
                </div>
            </div>
            <a href="cadastro.php" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all">
                <i class="fas fa-users mr-1"></i> Ir para Cadastro de Clientes
            </a>
        </div>
        
        <!-- Formulário Dinâmico -->
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h2 class="text-sm font-bold uppercase tracking-wider text-indigo-700">1. Dados Gerais da Cotação</h2>
            <!-- Dropdown Clientes -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label class="block text-xs font-bold mb-1">Cliente Cadastrado</label>
                    <select id="sel_cliente" class="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs">
                        <option value="">-- Selecionar Cliente --</option>
                        <?php foreach ($clientes as $c): ?>
                            <option value="<?= $c['id'] ?>" data-doc="<?= htmlspecialchars($c['document']) ?>" data-phone="<?= htmlspecialchars($c['phone']) ?>">
                                <?= htmlspecialchars($c['name']) ?> (<?= htmlspecialchars($c['document']) ?>)
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;

  const phpCode = `<?php
/**
 * CADASTRO DE CLIENTES MODERNO - PHP + MYSQL + API RECEITA/VIACEP
 * 
 * Desenvolvido com Tailwind CSS v3, integrações com APIs Públicas brasileiras
 * para consulta automática de CNPJ (BrasilAPI) e CEP (ViaCEP).
 */

// Configurações do Banco de Dados
$db_host = 'localhost';
$db_name = 'cadastro_clientes';
$db_user = 'root';
$db_pass = '';

$message = '';
$message_type = ''; // success | error

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    // Caso queira rodar sem banco primeiro, criamos um aviso
    $db_error = "Erro ao conectar ao banco de dados: " . $e->getMessage();
}

// Trata requisições AJAX para consulta de CNPJ via PHP backend (alternativa ao frontend)
if (isset($_GET['action'])) {
    header('Content-Type: application/json');
    if ($_GET['action'] == 'busca_cnpj' && isset($_GET['cnpj'])) {
        $cnpj = preg_replace('/\\D/', '', $_GET['cnpj']);
        $url = "https://brasilapi.com.br/api/cnpj/v1/{$cnpj}";
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode == 200) {
            echo $response;
        } else {
            echo json_encode(['erro' => true, 'mensagem' => 'CNPJ não encontrado ou limite de requisições excedido.']);
        }
        exit;
    }
}

// Ações CRUD no PHP
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($pdo)) {
    $action = $_POST['action'] ?? '';
    
    if ($action === 'salvar') {
        $id = $_POST['id'] ?? '';
        $type = $_POST['type'] ?? 'CNPJ';
        $document = preg_replace('/\\D/', '', $_POST['document'] ?? '');
        $name = $_POST['name'] ?? '';
        $fantasy_name = $_POST['fantasy_name'] ?? '';
        $cep = preg_replace('/\\D/', '', $_POST['cep'] ?? '');
        $street = $_POST['street'] ?? '';
        $neighborhood = $_POST['neighborhood'] ?? '';
        $city = $_POST['city'] ?? '';
        $state = $_POST['state'] ?? '';
        $situation = $_POST['situation'] ?? 'Ativo';
        $contact_person = $_POST['contact_person'] ?? '';
        $phone = $_POST['phone'] ?? '';
        $email = $_POST['email'] ?? '';
        $enabled = isset($_POST['enabled']) ? 1 : 0;
        $registration_date = $_POST['registration_date'] ?? date('Y-m-d');

        try {
            if (!empty($id)) {
                // UPDATE
                $stmt = $pdo->prepare("UPDATE clientes SET 
                    type = ?, document = ?, name = ?, fantasy_name = ?, cep = ?, 
                    street = ?, neighborhood = ?, city = ?, state = ?, situation = ?, 
                    contact_person = ?, phone = ?, email = ?, enabled = ?, registration_date = ? 
                    WHERE id = ?");
                $stmt->execute([
                    $type, $document, $name, $fantasy_name, $cep, 
                    $street, $neighborhood, $city, $state, $situation, 
                    $contact_person, $phone, $email, $enabled, $registration_date, $id
                ]);
                $message = "Cliente atualizado com sucesso!";
            } else {
                // INSERT
                $stmt = $pdo->prepare("INSERT INTO clientes 
                    (type, document, name, fantasy_name, cep, street, neighborhood, city, state, situation, contact_person, phone, email, enabled, registration_date) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([
                    $type, $document, $name, $fantasy_name, $cep, 
                    $street, $neighborhood, $city, $state, $situation, 
                    $contact_person, $phone, $email, $enabled, $registration_date
                ]);
                $message = "Cliente cadastrado com sucesso!";
            }
            $message_type = "success";
        } catch (PDOException $e) {
            $message = "Erro ao salvar: " . $e->getMessage();
            $message_type = "error";
        }
    } elseif ($action === 'excluir') {
        $id = $_POST['id'] ?? '';
        if (!empty($id)) {
            try {
                $stmt = $pdo->prepare("DELETE FROM clientes WHERE id = ?");
                $stmt->execute([$id]);
                $message = "Cliente excluído com sucesso!";
                $message_type = "success";
            } catch (PDOException $e) {
                $message = "Erro ao excluir: " . $e->getMessage();
                $message_type = "error";
            }
        }
    }
}

// Carregar Clientes cadastrados do Banco de Dados
$clientes = [];
if (isset($pdo)) {
    try {
        $stmt = $pdo->query("SELECT * FROM clientes ORDER BY id DESC");
        $clientes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        $clientes_error = "Erro ao buscar clientes: " . $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cadastro de Clientes</title>
    <!-- Tailwind CSS CDN para Estilização Moderna -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
                        mono: ['"JetBrains Mono"', 'monospace'],
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-slate-50 min-h-screen text-slate-800 antialiased font-sans flex flex-col pb-12">

    <!-- Cabeçalho Principal -->
    <header class="bg-gradient-to-r from-slate-900 to-indigo-950 text-white py-6 shadow-md border-b border-indigo-900/40">
        <div class="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div class="flex items-center gap-3">
                <div class="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                    <svg class="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                </div>
                <div>
                    <h1 class="text-xl font-bold tracking-tight">CADASTRO DE CLIENTES</h1>
                    <p class="text-xs text-indigo-300 font-mono">SEFAZ & Receita Federal Live Integrator</p>
                </div>
            </div>
            <div class="flex items-center gap-2 bg-indigo-950/60 px-4 py-1.5 rounded-full border border-indigo-800/50 text-xs">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span class="text-slate-300 font-mono">SGBD: MariaDB / MySQL</span>
            </div>
        </div>
    </header>

    <!-- Conteúdo Principal -->
    <main class="max-w-6xl mx-auto px-4 mt-8 flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <!-- Formulário de Cadastro -->
        <div class="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            
            <!-- Barra de Status / Alerta de Erro de Conexão com Banco -->
            <?php if (isset($db_error)): ?>
                <div class="bg-amber-50 border-b border-amber-200 p-4 text-amber-800 flex items-center gap-3 text-sm">
                    <svg class="w-5 h-5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                    <div>
                        <span class="font-bold">Aviso Local:</span> <?php echo $db_error; ?> 
                        <p class="text-xs text-amber-700 mt-1">O formulário funcionará offline e com consultas de API de forma visual, mas o salvamento persistente necessita do banco MySQL ativo.</p>
                    </div>
                </div>
            <?php endif; ?>

            <!-- Mensagem de Sucesso ou Erro de Operação -->
            <?php if (!empty($message)): ?>
                <div class="p-4 border-b text-sm flex items-center gap-3 <?php echo $message_type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-rose-50 text-rose-800 border-rose-100'; ?>">
                    <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <?php if ($message_type === 'success'): ?>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        <?php else: ?>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        <?php endif; ?>
                    </svg>
                    <span class="font-medium"><?php echo $message; ?></span>
                </div>
            <?php endif; ?>

            <!-- Formulário -->
            <form id="cadastroForm" method="POST" action="" class="p-6 md:p-8 space-y-6">
                <input type="hidden" name="action" id="formAction" value="salvar">
                <input type="hidden" name="id" id="clientId" value="">

                <!-- Seletor de Tipo (CNPJ / CPF) -->
                <div class="flex items-center gap-6 pb-4 border-b border-slate-100">
                    <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo de Contribuinte</span>
                    <div class="flex items-center gap-4">
                        <label class="flex items-center gap-2 cursor-pointer group">
                            <input type="radio" name="type" value="CNPJ" checked class="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer" onclick="toggleType('CNPJ')">
                            <span class="text-sm font-medium text-slate-700 group-hover:text-slate-900">Pessoa Jurídica (CNPJ)</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer group">
                            <input type="radio" name="type" value="CPF" class="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer" onclick="toggleType('CPF')">
                            <span class="text-sm font-medium text-slate-700 group-hover:text-slate-900">Pessoa Física (CPF)</span>
                        </label>
                    </div>
                </div>

                <!-- Linha 1: CNPJ / CPF e Nome/Razão Social -->
                <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div class="md:col-span-4 space-y-1.5 relative">
                        <label id="lblDocument" class="block text-xs font-semibold text-slate-600">CNPJ</label>
                        <div class="relative rounded-lg shadow-sm">
                            <input type="text" name="document" id="txtDocument" placeholder="00.000.000/0000-00" required
                                class="w-full pl-3 pr-10 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all duration-200 outline-none text-sm">
                            
                            <!-- Botão de Consulta Automática -->
                            <button type="button" id="btnConsultar" onclick="consultarDados()"
                                class="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors border border-indigo-100 hover:border-indigo-200 shrink-0 flex items-center justify-center" title="Consultar Receita / SEFAZ">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div class="md:col-span-8 space-y-1.5">
                        <label id="lblNome" class="block text-xs font-semibold text-slate-600">Razão Social / Nome Completo</label>
                        <input type="text" name="name" id="txtName" required
                            class="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all duration-200 outline-none text-sm">
                    </div>
                </div>

                <!-- Linha 2: Nome Fantasia e Situação -->
                <div id="rowFantasy" class="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div class="md:col-span-8 space-y-1.5">
                        <label class="block text-xs font-semibold text-slate-600">Nome Fantasia</label>
                        <input type="text" name="fantasy_name" id="txtFantasyName"
                            class="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all duration-200 outline-none text-sm">
                    </div>

                    <div class="md:col-span-4 space-y-1.5">
                        <label class="block text-xs font-semibold text-slate-600">Situação Cadastral</label>
                        <input type="text" name="situation" id="txtSituation" value="ATIVA"
                            class="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all duration-200 outline-none text-sm font-semibold text-emerald-600">
                    </div>
                </div>

                <!-- Linha 3: CEP e Rua -->
                <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div class="md:col-span-4 space-y-1.5">
                        <label class="block text-xs font-semibold text-slate-600">CEP</label>
                        <input type="text" name="cep" id="txtCep" placeholder="00000-000" required onblur="consultarCep()"
                            class="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all duration-200 outline-none text-sm">
                    </div>

                    <div class="md:col-span-8 space-y-1.5">
                        <label class="block text-xs font-semibold text-slate-600">Digite a Rua (Endereço)</label>
                        <input type="text" name="street" id="txtStreet" required
                            class="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all duration-200 outline-none text-sm">
                    </div>
                </div>

                <!-- Linha 4: Bairro, Cidade e UF -->
                <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div class="md:col-span-5 space-y-1.5">
                        <label class="block text-xs font-semibold text-slate-600">Bairro</label>
                        <input type="text" name="neighborhood" id="txtNeighborhood" required
                            class="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all duration-200 outline-none text-sm">
                    </div>

                    <div class="md:col-span-5 space-y-1.5">
                        <label class="block text-xs font-semibold text-slate-600">Cidade</label>
                        <input type="text" name="city" id="txtCity" required
                            class="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all duration-200 outline-none text-sm">
                    </div>

                    <div class="md:col-span-2 space-y-1.5">
                        <label class="block text-xs font-semibold text-slate-600">UF</label>
                        <input type="text" name="state" id="txtState" maxlength="2" required placeholder="SP"
                            class="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all duration-200 outline-none text-sm uppercase text-center font-bold">
                    </div>
                </div>

                <!-- Linha 5: Contato, Telefone e Email -->
                <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div class="md:col-span-4 space-y-1.5">
                        <label class="block text-xs font-semibold text-slate-600">Contato / Representante</label>
                        <input type="text" name="contact_person" id="txtContact"
                            class="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all duration-200 outline-none text-sm">
                    </div>

                    <div class="md:col-span-4 space-y-1.5">
                        <label class="block text-xs font-semibold text-slate-600">Telefone de Contato</label>
                        <input type="text" name="phone" id="txtPhone" placeholder="(11) 99999-9999" required
                            class="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all duration-200 outline-none text-sm">
                    </div>

                    <div class="md:col-span-4 space-y-1.5">
                        <label class="block text-xs font-semibold text-slate-600">Email do Contribuinte</label>
                        <input type="email" name="email" id="txtEmail" placeholder="contato@empresa.com" required
                            class="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all duration-200 outline-none text-sm">
                    </div>
                </div>

                <!-- Linha 6: Habilitado e Data de Cadastro -->
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 pt-4 border-t border-slate-100">
                    <div class="flex items-center gap-2">
                        <input type="checkbox" name="enabled" id="chkEnabled" checked value="1"
                            class="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer">
                        <label for="chkEnabled" class="text-sm font-medium text-slate-700 cursor-pointer select-none">Habilitado no Sistema</label>
                    </div>

                    <div class="flex items-center gap-3">
                        <label class="text-xs font-semibold text-slate-500">Data de Cadastro:</label>
                        <input type="date" name="registration_date" id="txtRegistrationDate" value="<?php echo date('Y-m-d'); ?>" required
                            class="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:border-indigo-500">
                    </div>
                </div>

                <!-- Seção CONTROLE (Botões de Ação) -->
                <div class="p-4 bg-slate-50 border border-slate-200/60 rounded-xl flex flex-wrap justify-between items-center gap-4 mt-8">
                    <span class="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1 font-mono">Painel de Controle</span>
                    <div class="flex items-center gap-2.5 ml-auto">
                        <button type="button" onclick="limparFormulario()"
                            class="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shadow-xs">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                            Limpar / Sair
                        </button>
                        
                        <button type="button" id="btnExcluirForm" onclick="excluirRegistro()" disabled
                            class="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-medium transition-all flex items-center gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                            Excluir
                        </button>

                        <button type="submit"
                            class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-sm shadow-indigo-200">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
                            </svg>
                            Salvar Registro
                        </button>
                    </div>
                </div>
            </form>
        </div>

        <!-- Clientes Cadastrados (Banco de Dados Local) -->
        <div class="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 flex flex-col max-h-[820px] overflow-hidden">
            <div class="pb-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h2 class="font-bold text-slate-800 text-base">Clientes Salvos</h2>
                    <p class="text-xs text-slate-400">Banco de Dados MySQL</p>
                </div>
                <span class="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100/50 font-mono">
                    <?php echo count($clientes); ?>
                </span>
            </div>

            <!-- Pesquisa de Clientes -->
            <div class="my-4 relative">
                <input type="text" id="searchClient" onkeyup="filtrarClientes()" placeholder="Procurar por nome, CNPJ..."
                    class="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 transition-all">
                <svg class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
            </div>

            <!-- Lista de Clientes -->
            <div class="flex-1 overflow-y-auto space-y-3 pr-1" id="clientList">
                <?php if (empty($clientes)): ?>
                    <div class="text-center py-12 text-slate-400">
                        <svg class="w-8 h-8 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v2m4-3h4m-4 4h4m-4 4h2"></path>
                        </svg>
                        <p class="text-xs">Nenhum cliente cadastrado.</p>
                        <p class="text-[10px] text-slate-400/80 mt-1">Preencha o form e salve para popular.</p>
                    </div>
                <?php else: ?>
                    <?php foreach ($clientes as $c): ?>
                        <div class="p-3 bg-slate-50 hover:bg-indigo-50/40 border border-slate-100 rounded-xl cursor-pointer transition-all hover:border-indigo-200/50 group" 
                            onclick="editarCliente(<?php echo htmlspecialchars(json_encode($c)); ?>)">
                            <div class="flex items-center justify-between mb-1">
                                <span class="px-1.5 py-0.5 bg-slate-200/70 text-slate-600 text-[10px] font-bold rounded uppercase tracking-wide">
                                    <?php echo $c['type']; ?>
                                </span>
                                <span class="text-[10px] text-slate-400 font-mono">
                                    <?php echo date('d/m/Y', strtotime($c['registration_date'])); ?>
                                </span>
                            </div>
                            <h4 class="text-xs font-semibold text-slate-800 line-clamp-1 group-hover:text-indigo-900 transition-colors">
                                <?php echo htmlspecialchars($c['name']); ?>
                            </h4>
                            <p class="text-[11px] text-slate-500 font-mono mt-0.5">
                                <?php echo htmlspecialchars($c['document']); ?>
                            </p>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>
    </main>

    <!-- JavaScript Integrado com Validações e Busca de APIs -->
    <script>
        // Formatações em Tempo Real
        document.getElementById('txtDocument').addEventListener('input', function(e) {
            let isCnpj = document.querySelector('input[name="type"]:checked').value === 'CNPJ';
            let v = e.target.value.replace(/\\D/g, '');
            if (isCnpj) {
                if (v.length > 14) v = v.slice(0, 14);
                // Formato CNPJ: 00.000.000/0000-00
                if (v.length <= 2) {}
                else if (v.length <= 5) { v = v.slice(0,2) + '.' + v.slice(2); }
                else if (v.length <= 8) { v = v.slice(0,2) + '.' + v.slice(2,5) + '.' + v.slice(5); }
                else if (v.length <= 12) { v = v.slice(0,2) + '.' + v.slice(2,5) + '.' + v.slice(5,8) + '/' + v.slice(8); }
                else { v = v.slice(0,2) + '.' + v.slice(2,5) + '.' + v.slice(5,8) + '/' + v.slice(8,12) + '-' + v.slice(12,14); }
            } else {
                if (v.length > 11) v = v.slice(0, 11);
                // Formato CPF: 000.000.000-00
                if (v.length <= 3) {}
                else if (v.length <= 6) { v = v.slice(0,3) + '.' + v.slice(3); }
                else if (v.length <= 9) { v = v.slice(0,3) + '.' + v.slice(3,6) + '.' + v.slice(6); }
                else { v = v.slice(0,3) + '.' + v.slice(3,6) + '.' + v.slice(6,9) + '-' + v.slice(9,11); }
            }
            e.target.value = v;
        });

        document.getElementById('txtCep').addEventListener('input', function(e) {
            let v = e.target.value.replace(/\\D/g, '');
            if (v.length > 8) v = v.slice(0, 8);
            if (v.length > 5) { v = v.slice(0,5) + '-' + v.slice(5); }
            e.target.value = v;
        });

        document.getElementById('txtPhone').addEventListener('input', function(e) {
            let v = e.target.value.replace(/\\D/g, '');
            if (v.length > 11) v = v.slice(0, 11);
            if (v.length <= 2) { v = v ? '(' + v : ''; }
            else if (v.length <= 6) { v = '(' + v.slice(0,2) + ') ' + v.slice(2); }
            else if (v.length <= 10) { v = '(' + v.slice(0,2) + ') ' + v.slice(2,6) + '-' + v.slice(6); }
            else { v = '(' + v.slice(0,2) + ') ' + v.slice(2,7) + '-' + v.slice(7); }
            e.target.value = v;
        });

        // Alternador de Interface para CNPJ / CPF
        function toggleType(type) {
            const labelDoc = document.getElementById('lblDocument');
            const labelNome = document.getElementById('lblNome');
            const inputDoc = document.getElementById('txtDocument');
            const rowFantasy = document.getElementById('rowFantasy');

            inputDoc.value = '';
            
            if (type === 'CNPJ') {
                labelDoc.textContent = 'CNPJ';
                labelNome.textContent = 'Razão Social';
                inputDoc.placeholder = '00.000.000/0000-00';
                rowFantasy.style.display = 'grid';
            } else {
                labelDoc.textContent = 'CPF';
                labelNome.textContent = 'Nome Completo';
                inputDoc.placeholder = '000.000.000-00';
                rowFantasy.style.display = 'none';
            }
        }

        // Consulta Receita Federal (CNPJ) via BrasilAPI
        async function consultarDados() {
            const isCnpj = document.querySelector('input[name="type"]:checked').value === 'CNPJ';
            const doc = document.getElementById('txtDocument').value.replace(/\\D/g, '');
            
            if (!isCnpj) {
                alert('A consulta automática está disponível apenas para CNPJ de empresas.');
                return;
            }

            if (doc.length !== 14) {
                alert('Digite um CNPJ completo (14 números) para realizar a consulta.');
                return;
            }

            const btn = document.getElementById('btnConsultar');
            btn.innerHTML = '<svg class="w-4 h-4 animate-spin text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15.89M21 3v5h-5"></path></svg>';
            btn.disabled = true;

            try {
                // Consultamos diretamente via BrasilAPI para evitar CORS ou bloqueios
                const response = await fetch(\`https://brasilapi.com.br/api/cnpj/v1/\${doc}\`);
                if (!response.ok) throw new Error();
                const data = await response.json();

                document.getElementById('txtName').value = data.razao_social || '';
                document.getElementById('txtFantasyName').value = data.nome_fantasia || '';
                document.getElementById('txtSituation').value = data.descricao_situacao_cadastral || 'ATIVA';
                document.getElementById('txtCep').value = data.cep ? data.cep.slice(0,5) + '-' + data.cep.slice(5) : '';
                document.getElementById('txtStreet').value = data.logradouro || '';
                document.getElementById('txtNeighborhood').value = data.bairro || '';
                document.getElementById('txtCity').value = data.municipio || '';
                document.getElementById('txtState').value = data.uf || '';
                document.getElementById('txtEmail').value = data.email || '';
                
                if (data.ddd_telefone_1) {
                    let tel = data.ddd_telefone_1.replace(/\\D/g, '');
                    if (tel.length === 10) {
                        document.getElementById('txtPhone').value = '(' + tel.slice(0,2) + ') ' + tel.slice(2,6) + '-' + tel.slice(6);
                    } else if (tel.length === 11) {
                        document.getElementById('txtPhone').value = '(' + tel.slice(0,2) + ') ' + tel.slice(2,7) + '-' + tel.slice(7);
                    }
                }

                alert('Dados recuperados com sucesso diretamente da Receita Federal!');
            } catch (err) {
                alert('Infelizmente não foi possível consultar os dados deste CNPJ na Receita Federal.');
            } finally {
                btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>';
                btn.disabled = false;
            }
        }

        // Consulta CEP (ViaCEP)
        async function consultarCep() {
            const cepInput = document.getElementById('txtCep');
            const cep = cepInput.value.replace(/\\D/g, '');

            if (cep.length !== 8) return;

            try {
                const response = await fetch(\`https://viacep.com.br/ws/\${cep}/json/\`);
                const data = await response.json();

                if (!data.erro) {
                    document.getElementById('txtStreet').value = data.logradouro || '';
                    document.getElementById('txtNeighborhood').value = data.bairro || '';
                    document.getElementById('txtCity').value = data.localidade || '';
                    document.getElementById('txtState').value = data.uf || '';
                }
            } catch (e) {
                console.error('Erro ao consultar CEP');
            }
        }

        // Preenche o Formulário para Edição de Cliente
        function editarCliente(c) {
            document.getElementById('clientId').value = c.id;
            
            if (c.type === 'CNPJ') {
                document.querySelector('input[name="type"][value="CNPJ"]').checked = true;
                toggleType('CNPJ');
                document.getElementById('txtFantasyName').value = c.fantasy_name || '';
            } else {
                document.querySelector('input[name="type"][value="CPF"]').checked = true;
                toggleType('CPF');
            }

            document.getElementById('txtDocument').value = c.document;
            document.getElementById('txtName').value = c.name;
            document.getElementById('txtCep').value = c.cep;
            document.getElementById('txtStreet').value = c.street;
            document.getElementById('txtNeighborhood').value = c.neighborhood;
            document.getElementById('txtCity').value = c.city;
            document.getElementById('txtState').value = c.state;
            document.getElementById('txtSituation').value = c.situation || 'ATIVA';
            document.getElementById('txtContact').value = c.contact_person || '';
            document.getElementById('txtPhone').value = c.phone || '';
            document.getElementById('txtEmail').value = c.email || '';
            document.getElementById('chkEnabled').checked = parseInt(c.enabled) === 1;
            document.getElementById('txtRegistrationDate').value = c.registration_date;

            document.getElementById('btnExcluirForm').disabled = false;
        }

        // Limpa Formulário
        function limparFormulario() {
            document.getElementById('cadastroForm').reset();
            document.getElementById('clientId').value = '';
            document.getElementById('btnExcluirForm').disabled = true;
            document.getElementById('txtRegistrationDate').value = '<?php echo date("Y-m-d"); ?>';
            toggleType('CNPJ');
        }

        // Configura ação de exclusão no Form
        function excluirRegistro() {
            if (confirm('Tem certeza que deseja excluir permanentemente este cliente?')) {
                document.getElementById('formAction').value = 'excluir';
                document.getElementById('cadastroForm').submit();
            }
        }

        // Filtro em tempo real na lista lateral
        function filtrarClientes() {
            const term = document.getElementById('searchClient').value.toLowerCase();
            const listItems = document.querySelectorAll('#clientList > div');
            
            listItems.forEach(item => {
                const text = item.textContent.toLowerCase();
                if (text.includes(term)) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        }
    </script>
</body>
</html>`;

  const sqlCode = `-- Criar Banco de Dados
CREATE DATABASE IF NOT EXISTS cadastro_clientes;
USE cadastro_clientes;

-- 1. Criar Tabela de Clientes
CREATE TABLE IF NOT EXISTS clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(10) NOT NULL,              -- CNPJ ou CPF
    document VARCHAR(20) NOT NULL,          -- CNPJ/CPF com pontuação
    name VARCHAR(150) NOT NULL,             -- Razão Social / Nome
    fantasy_name VARCHAR(150) NULL,         -- Nome Fantasia
    cep VARCHAR(10) NOT NULL,               -- CEP
    street VARCHAR(150) NOT NULL,           -- Logradouro
    neighborhood VARCHAR(100) NOT NULL,     -- Bairro
    city VARCHAR(100) NOT NULL,             -- Cidade
    state CHAR(2) NOT NULL,                 -- UF
    situation VARCHAR(50) DEFAULT 'ATIVA',  -- Situação cadastral
    contact_person VARCHAR(100) NULL,       -- Contato
    phone VARCHAR(25) NOT NULL,             -- Telefone
    email VARCHAR(100) NOT NULL,            -- Email
    enabled TINYINT(1) DEFAULT 1,           -- Habilitado (0 ou 1)
    registration_date DATE NOT NULL,        -- Data de Cadastro
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Criar Tabela de Orçamentos / Vendas (UsiCorte)
CREATE TABLE IF NOT EXISTS orcamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quote_number VARCHAR(50) NOT NULL UNIQUE,
    client_id INT NULL,
    client_name VARCHAR(150) NOT NULL,
    client_document VARCHAR(25) NULL,
    contact_person VARCHAR(100) NULL,
    quote_date DATE NOT NULL,
    validity_days INT DEFAULT 10,
    payment_terms VARCHAR(100) DEFAULT 'À Vista',
    status VARCHAR(30) DEFAULT 'Rascunho',
    discount DECIMAL(10,2) DEFAULT 0.00,
    shipping DECIMAL(10,2) DEFAULT 0.00,
    subtotal_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    grand_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    observations TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clientes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Criar Tabela de Itens do Orçamento
CREATE TABLE IF NOT EXISTS orcamento_itens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    orcamento_id INT NOT NULL,
    description VARCHAR(255) NOT NULL,
    constant VARCHAR(30) DEFAULT '1.0',     -- Fator / Densidade
    measure VARCHAR(50) NULL,              -- Espessura / Medida
    diameter VARCHAR(50) NULL,             -- Diâmetro Ø
    width_length VARCHAR(100) NULL,        -- Largura x Comprimento
    unit_price DECIMAL(10,2) NOT NULL,     -- Valor Unitário
    quantity DECIMAL(10,2) NOT NULL,       -- QTD
    subtotal DECIMAL(10,2) NOT NULL,       -- Subtotal = Unit * Qty
    notes VARCHAR(255) NULL,
    FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Criar Tabela de Usuários / Funcionários
CREATE TABLE IF NOT EXISTS usuarios (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    senha TEXT NOT NULL,
    perfil VARCHAR(20) DEFAULT 'FUNCIONARIO', -- 'ADMIN' ou 'FUNCIONARIO'
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Dados Fictícios de Exemplo para Teste Rápido
INSERT INTO clientes (type, document, name, fantasy_name, cep, street, neighborhood, city, state, situation, phone, email, enabled, registration_date) 
VALUES 
('CNPJ', '12.345.678/0001-90', 'Brasil Tecnologias S/A', 'Br Tech', '01311-200', 'Avenida Paulista', 'Bela Vista', 'São Paulo', 'SP', 'ATIVA', '(11) 3254-9000', 'comercial@brtech.com.br', 1, '2026-01-15'),
('CPF', '111.222.333-44', 'Oziel Medrade de Souza', '', '01001-000', 'Praça da Sé', 'Sé', 'São Paulo', 'SP', 'ATIVA', '(11) 98888-7777', 'medradeoziel@gmail.com', 1, '2026-07-20');
`;

  const copyToClipboard = (text: string, type: 'php' | 'vendas' | 'sql') => {
    navigator.clipboard.writeText(text);
    setCopiedTab(type);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const getActiveCode = () => {
    switch (activeFile) {
      case 'php': return phpCode;
      case 'vendas': return vendasPhpCode;
      case 'sql': return sqlCode;
    }
  };

  return (
    <div id="php-code-panel" className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden mt-10 transition-all duration-300">
      <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
            <Terminal className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-bold text-slate-200 text-sm">Código Fonte para seu Servidor PHP / MySQL</h3>
            <p className="text-xs text-slate-400">Implementação completa autossuficiente e pronta para rodar no XAMPP / Apache.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveFile('php')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeFile === 'php' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            cadastro.php
          </button>
          <button
            onClick={() => setActiveFile('vendas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeFile === 'vendas' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            vendas_orcamentos.php
          </button>
          <button
            onClick={() => setActiveFile('sql')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeFile === 'sql' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            schema.sql
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Instructions */}
        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 text-xs leading-relaxed text-slate-300">
          <p className="font-bold text-slate-200 mb-1.5 flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
            Como Executar no seu Computador (XAMPP / WampServer / Docker / Apache)
          </p>
          <ol className="list-decimal pl-4 space-y-1 text-slate-400">
            <li>Abra o painel do seu <b>MySQL (PhpMyAdmin)</b> e execute o script da aba <span className="text-indigo-400 font-semibold font-mono">schema.sql</span> para criar as tabelas (<code className="bg-slate-800 text-slate-300 px-1 py-0.5 rounded">clientes</code>, <code className="bg-slate-800 text-slate-300 px-1 py-0.5 rounded">orcamentos</code> e <code className="bg-slate-800 text-slate-300 px-1 py-0.5 rounded">orcamento_itens</code>).</li>
            <li>Copie os arquivos <span className="text-indigo-400 font-semibold font-mono">cadastro.php</span> e <span className="text-indigo-400 font-semibold font-mono">vendas_orcamentos.php</span> para sua pasta do servidor local (ex: <code className="bg-slate-800 text-slate-300 px-1 py-0.5 rounded">htdocs/</code>).</li>
            <li>Abra no seu navegador: <code className="bg-indigo-950/60 text-indigo-300 px-1.5 py-0.5 rounded font-mono font-semibold">http://localhost/cadastro.php</code> ou <code className="bg-indigo-950/60 text-indigo-300 px-1.5 py-0.5 rounded font-mono font-semibold">http://localhost/vendas_orcamentos.php</code></li>
          </ol>
        </div>

        {/* Code display area */}
        <div className="relative group">
          <button
            onClick={() => copyToClipboard(getActiveCode(), activeFile)}
            className="absolute right-4 top-4 px-3 py-1.5 bg-slate-800/80 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md border border-slate-700/50 hover:border-indigo-500 cursor-pointer"
          >
            {copiedTab === activeFile ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copiar Código
              </>
            )}
          </button>

          <pre className="p-4 bg-slate-950 rounded-xl overflow-x-auto text-[11px] leading-relaxed font-mono max-h-[420px] border border-slate-800/50 text-slate-300 select-all">
            {getActiveCode()}
          </pre>
        </div>
      </div>
    </div>
  );
}
