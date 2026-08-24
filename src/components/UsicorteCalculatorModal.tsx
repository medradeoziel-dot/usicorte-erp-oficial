import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Calculator, 
  Layers, 
  CircleDot, 
  Plus, 
  Copy, 
  Check, 
  Box, 
  Grid,
  Zap,
  ChevronDown 
} from 'lucide-react';
import { 
  tabelaConstantes, 
  calculateItemWeightKg, 
  parseNumberBR, 
  parseDimensionToMm,
  TabelaConstanteItem 
} from '../utils/calculator';

interface UsicorteCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItemToQuote?: (item: any) => void;
}

// Popular gauge / bitola list (in mm)
const BITOLAS_POPULARES = [
  { label: '20 GA (0,90 mm)', val: '0.90' },
  { label: '18 GA (1,20 mm)', val: '1.20' },
  { label: '16 GA (1,50 mm)', val: '1.50' },
  { label: '14 GA (1,90 mm)', val: '1.90' },
  { label: '1/8" (3,17 mm)', val: '3.17' },
  { label: '3/16" (4,75 mm)', val: '4.75' },
  { label: '1/4" (6,35 mm)', val: '6.35' },
  { label: '5/16" (8,00 mm)', val: '8.00' },
  { label: '3/8" (9,52 mm)', val: '9.52' },
  { label: '1/2" (12,70 mm)', val: '12.70' },
  { label: '5/8" (15,87 mm)', val: '15.87' },
  { label: '3/4" (19,05 mm)', val: '19.05' },
  { label: '1" (25,40 mm)', val: '25.40' },
  { label: '1.1/2" (38,10 mm)', val: '38.10' },
  { label: '2" (50,80 mm)', val: '50.80' }
];

export default function UsicorteCalculatorModal({
  isOpen,
  onClose,
  onAddItemToQuote
}: UsicorteCalculatorModalProps) {
  // Form State
  const defaultLaserIdx = tabelaConstantes.findIndex(m => m.nome === 'LASER A36');
  const [materialIndex, setMaterialIndex] = useState<string>(() => defaultLaserIdx !== -1 ? String(defaultLaserIdx) : '19'); // Default: LASER A36
  const [tipo, setTipo] = useState<'chapa' | 'macico' | 'bucha'>('chapa');
  const [precoKg, setPrecoKg] = useState<string>('22');
  
  const [diametro, setDiametro] = useState<string>('0');
  const [espessura, setEspessura] = useState<string>('');
  const [largura, setLargura] = useState<string>('');
  const [comprimento, setComprimento] = useState<string>('');
  const [quantidade, setQuantidade] = useState<string>('1');
  const [descricao, setDescricao] = useState<string>('LASER A36');
  const [observacao, setObservacao] = useState<string>('');

  const [showBitolasModal, setShowBitolasModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [addedMessage, setAddedMessage] = useState<boolean>(false);
  const [nestingMessage, setNestingMessage] = useState<boolean>(false);

  // Refs for tab loop navigation
  const constanteRef = useRef<HTMLSelectElement>(null);
  const diametroRef = useRef<HTMLInputElement>(null);
  const espessuraRef = useRef<HTMLInputElement>(null);
  const larguraRef = useRef<HTMLInputElement>(null);
  const comprimentoRef = useRef<HTMLInputElement>(null);
  const qtdRef = useRef<HTMLInputElement>(null);
  const precoKgRef = useRef<HTMLInputElement>(null);
  const btnAdicionarRef = useRef<HTMLButtonElement>(null);

  // Sync material selection
  const handleMaterialSelect = (indexStr: string) => {
    setMaterialIndex(indexStr);
    if (indexStr === "") {
      setPrecoKg('');
      setDescricao('');
      return;
    }

    const idx = parseInt(indexStr, 10);
    const mat = tabelaConstantes[idx];
    if (mat) {
      setTipo(mat.tipo);
      setPrecoKg(String(Math.ceil(mat.precoKg)));
      setDescricao(mat.nome);

      if (mat.tipo === 'chapa') {
        setDiametro('0');
      } else if (mat.tipo === 'macico') {
        setEspessura('');
        setLargura('');
      } else if (mat.tipo === 'bucha') {
        setLargura('');
      }
    }
  };

  // Preset Sheet dimensions helper
  const aplicarDimensao = (larg: number, comp: number) => {
    setLargura(String(larg));
    setComprimento(String(comp));
  };

  // Calculations strictly per UsiCorte official formulas & Math.ceil rounding
  const selectedMat: TabelaConstanteItem | undefined = materialIndex !== "" ? tabelaConstantes[parseInt(materialIndex, 10)] : undefined;
  const kConst = selectedMat ? selectedMat.k : 0.00785;
  const tipoMat = selectedMat ? selectedMat.tipo : tipo;

  const diaNum = parseDimensionToMm(diametro);
  const espNum = parseDimensionToMm(espessura);
  const largNum = parseDimensionToMm(largura);
  const compNum = parseDimensionToMm(comprimento);
  const priceKgNum = parseNumberBR(precoKg);
  const qtdNum = Math.max(1, parseNumberBR(quantidade) || 1);

  // Calculate Unit Weight
  let pesoUnitario = 0;

  if (selectedMat) {
    if (tipoMat === 'chapa') {
      pesoUnitario = (espNum * largNum * compNum * kConst) / 1000;
    } else if (tipoMat === 'macico') {
      const d = diaNum || espNum;
      pesoUnitario = (d * d * compNum * kConst) / 1000;
    } else if (tipoMat === 'bucha') {
      const dExt = diaNum;
      const dInt = espNum;
      if (dExt > dInt && dInt > 0) {
        const pesoBruto = (dExt * dExt * compNum * kConst) / 1000;
        const pesoFuro = (dInt * dInt * compNum * kConst) / 1000;
        pesoUnitario = pesoBruto - pesoFuro;
      } else {
        pesoUnitario = (dExt * dExt * compNum * kConst) / 1000;
      }
    }
  }

  // Exact UsiCorte Rounding to upper integer & formatting with ,00
  const valorUnitarioCalculado = pesoUnitario * priceKgNum;
  const valorUnitarioArredondado = Math.ceil(valorUnitarioCalculado);

  const valorTotalCalculado = valorUnitarioArredondado * qtdNum;
  const valorTotalArredondado = Math.ceil(valorTotalCalculado);

  const pesoTotal = pesoUnitario * qtdNum;

  // Formatted Strings for Banner
  const pesoFormatted = pesoTotal > 0 ? pesoTotal.toFixed(3).replace('.', ',') + ' KG' : '0,000 KG';
  const unitarioFormatted = valorUnitarioArredondado > 0 
    ? 'R$ ' + valorUnitarioArredondado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : 'R$ 0,00';
  const totalFormatted = valorTotalArredondado > 0 
    ? 'R$ ' + valorTotalArredondado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : 'R$ 0,00';

  // Navigation Helper
  const focusNextField = (ref: React.RefObject<HTMLInputElement | HTMLSelectElement | HTMLButtonElement | null>) => {
    setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
        if ('select' in ref.current && typeof ref.current.select === 'function') {
          ref.current.select();
        }
      }
    }, 40);
  };

  const zerarFormulario = () => {
    setDiametro(tipoMat === 'chapa' ? '0' : '');
    setEspessura('');
    setLargura('');
    setComprimento('');
    setQuantidade('1');
    setObservacao('');
    focusNextField(constanteRef);
  };

  const adicionarAoPdv = () => {
    if (materialIndex === "") {
      alert('Selecione um material antes de adicionar!');
      focusNextField(constanteRef);
      return;
    }

    const descFinal = descricao.trim() || (selectedMat ? selectedMat.nome : 'Material');

    const newItem = {
      id: `item-${Date.now()}`,
      description: descFinal,
      material: selectedMat ? selectedMat.nome : descFinal,
      geometryType: tipoMat,
      constant: kConst,
      pricePerKg: priceKgNum,
      diameter: diametro,
      thickness: espessura,
      widthMm: largNum,
      lengthMm: compNum,
      quantity: qtdNum,
      unitWeightKg: pesoUnitario,
      totalWeightKg: pesoTotal,
      unitPrice: valorUnitarioArredondado,
      subtotal: valorTotalArredondado,
      notes: observacao
    };

    if (onAddItemToQuote) {
      onAddItemToQuote(newItem);
      setAddedMessage(true);
      setTimeout(() => setAddedMessage(false), 2000);
    } else {
      copiarResumo();
    }

    zerarFormulario();
  };

  const enviarParaNesting = () => {
    if (materialIndex === "") {
      alert('Selecione um material antes de enviar para otimização!');
      return;
    }

    const descFinal = (descricao.trim() || (selectedMat ? selectedMat.nome : 'Chapa')) + ' [NESTING 2D]';

    const newItem = {
      id: `item-${Date.now()}`,
      description: descFinal,
      material: selectedMat ? selectedMat.nome : descFinal,
      geometryType: tipoMat,
      constant: kConst,
      pricePerKg: priceKgNum,
      diameter: diametro,
      thickness: espessura,
      widthMm: largNum,
      lengthMm: compNum,
      quantity: qtdNum,
      unitWeightKg: pesoUnitario,
      totalWeightKg: pesoTotal,
      unitPrice: valorUnitarioArredondado,
      subtotal: valorTotalArredondado,
      notes: (observacao ? observacao + ' | ' : '') + 'Enviado para Otimização de Corte Nesting 2D CNC'
    };

    if (onAddItemToQuote) {
      onAddItemToQuote(newItem);
    }

    setNestingMessage(true);
    setTimeout(() => setNestingMessage(false), 2500);
    zerarFormulario();
  };

  const copiarResumo = () => {
    const matNome = selectedMat ? selectedMat.nome : '';
    const desc = descricao || matNome;
    const obs = observacao;

    const resumo = `[Usicorte] ${desc} | Qtd: ${quantidade} | Peso: ${pesoFormatted} | Total: ${totalFormatted}${obs ? ' | Obs: ' + obs : ''}`;
    navigator.clipboard.writeText(resumo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Rotation loop when TAB is pressed on Add Button
  const loopDeRotacao = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      adicionarAoPdv();
    }
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (constanteRef.current) {
          constanteRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#0b1329] text-white border border-gray-800 rounded-2xl w-full max-w-2xl p-5 shadow-2xl relative text-sm max-h-[95vh] overflow-y-auto flex flex-col">
        
        {/* CABEÇALHO COM LOGO USICORTE METAIS */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              className="text-gray-400 hover:text-white transition p-1 cursor-pointer"
            >
              ←
            </button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-600/20 border border-blue-500/40 rounded-lg flex items-center justify-center text-blue-400 font-extrabold text-lg shadow-inner">
                U
              </div>
              <div>
                <h2 className="text-base font-bold text-blue-400 leading-tight flex items-center gap-2">
                  Usicorte Metais
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-500/30">
                    Calculadora Oficial
                  </span>
                </h2>
                <p className="text-[11px] text-gray-400">Cotação e Calculadora de Peso de Materiais</p>
              </div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-gray-400 hover:text-white text-xl p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* FORMULÁRIO COM NAVEGAÇÃO EM LOOP */}
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          
          {/* SELEÇÃO DE MATERIAL (TABINDEX 1) */}
          <div>
            <label className="block text-xs text-gray-400 mb-1 font-medium">Constante / Material</label>
            <select 
              ref={constanteRef}
              tabIndex={1} 
              value={materialIndex}
              onChange={(e) => handleMaterialSelect(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (tipoMat === 'chapa') focusNextField(espessuraRef);
                  else focusNextField(diametroRef);
                }
              }}
              className="w-full bg-[#131f37] border border-gray-700 rounded-lg p-2.5 text-white focus:outline-hidden focus:border-blue-500 font-medium cursor-pointer"
            >
              <option value="">Selecione o perfil/material...</option>
              {tabelaConstantes.map((mat, index) => (
                <option key={index} value={index}>
                  {mat.nome} (k: {mat.k} | R$ {Math.ceil(mat.precoKg)}/kg)
                </option>
              ))}
            </select>
          </div>

          {/* BOTÕES DE DIMENSÕES PADRÃO DA CHAPA */}
          <div className="bg-[#081226]/60 border border-gray-800/80 rounded-xl p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-400 font-medium">Dimensões padrão da chapa</span>
              <span className="text-[10px] text-blue-400 font-medium">Selecione para preencher</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button 
                type="button" 
                onClick={() => aplicarDimensao(1200, 3000)} 
                className="bg-[#131f37] border border-blue-500/50 text-blue-300 font-bold py-2 px-1 rounded-lg text-xs hover:bg-blue-600 hover:text-white transition cursor-pointer"
              >
                1200x3000 mm
              </button>
              <button 
                type="button" 
                onClick={() => aplicarDimensao(1250, 3000)} 
                className="bg-[#131f37] border border-gray-700 text-gray-300 font-bold py-2 px-1 rounded-lg text-xs hover:bg-blue-600 hover:text-white transition cursor-pointer"
              >
                1250x3000 mm
              </button>
              <button 
                type="button" 
                onClick={() => aplicarDimensao(1500, 3000)} 
                className="bg-[#131f37] border border-gray-700 text-gray-300 font-bold py-2 px-1 rounded-lg text-xs hover:bg-blue-600 hover:text-white transition cursor-pointer"
              >
                1500x3000 mm
              </button>
              <button 
                type="button" 
                onClick={() => aplicarDimensao(1500, 6000)} 
                className="bg-[#131f37] border border-gray-700 text-gray-300 font-bold py-2 px-1 rounded-lg text-xs hover:bg-blue-600 hover:text-white transition cursor-pointer"
              >
                1500x6000 mm
              </button>
            </div>
          </div>

          {/* DIMENSÕES (TABINDEX 2 A 5) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            {/* Diâmetro */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs text-gray-400 font-medium">
                  {tipoMat === 'bucha' ? 'Diâmetro Ext. (Ø)' : 'Diâmetro (Ø)'}
                </label>
                {diaNum > 0 && diametro && (diametro.includes('/') || diametro.includes('"') || diametro.toLowerCase().includes('pol')) && (
                  <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/70 border border-emerald-700/50 px-1.5 py-0.2 rounded">
                    {diaNum.toFixed(2).replace(/\.?0+$/, '')} mm
                  </span>
                )}
              </div>
              <input 
                ref={diametroRef}
                type="text" 
                tabIndex={2} 
                disabled={tipoMat === 'chapa'}
                value={diametro}
                onChange={(e) => setDiametro(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (tipoMat === 'bucha') focusNextField(espessuraRef);
                    else focusNextField(comprimentoRef);
                  }
                }}
                placeholder="Ex: 32 ou 1.1/2" 
                className="w-full bg-[#131f37] border border-gray-700 rounded-lg p-2.5 text-white focus:outline-hidden focus:border-blue-500 font-bold disabled:opacity-30 disabled:cursor-not-allowed"
              />
            </div>

            {/* Espessura com Selector de Bitolas */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs text-gray-400 font-medium">
                  {tipoMat === 'bucha' ? 'Diâmetro Int. (Ø)' : 'Espessura (mm)'}
                </label>
                <div className="flex items-center gap-1.5">
                  {espNum > 0 && espessura && (espessura.includes('/') || espessura.includes('"') || espessura.toLowerCase().includes('pol')) && (
                    <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/70 border border-emerald-700/50 px-1.5 py-0.2 rounded">
                      {espNum.toFixed(2).replace(/\.?0+$/, '')} mm
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowBitolasModal(!showBitolasModal)}
                    className="text-[10px] text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    田 Bitolas
                  </button>
                </div>
              </div>
              <input 
                ref={espessuraRef}
                type="text" 
                tabIndex={3} 
                disabled={tipoMat === 'macico'}
                value={espessura}
                onChange={(e) => setEspessura(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (tipoMat === 'chapa') focusNextField(larguraRef);
                    else focusNextField(comprimentoRef);
                  }
                }}
                placeholder="Ex: 12.7 ou 1/2" 
                className="w-full bg-[#131f37] border border-gray-700 rounded-lg p-2.5 text-white focus:outline-hidden focus:border-blue-500 font-bold disabled:opacity-30 disabled:cursor-not-allowed"
              />

              {/* MODAL / DROPDOWN DE BITOLAS RÁPIDAS */}
              {showBitolasModal && (
                <div className="absolute z-20 mt-1 bg-gray-900 border border-blue-500/50 rounded-xl p-2 shadow-2xl max-h-48 overflow-y-auto text-xs grid grid-cols-2 gap-1 w-64">
                  {BITOLAS_POPULARES.map((b) => (
                    <button
                      key={b.val}
                      type="button"
                      onClick={() => {
                        setEspessura(b.val);
                        setShowBitolasModal(false);
                      }}
                      className="text-left px-2 py-1.5 hover:bg-blue-600 hover:text-white rounded-md text-gray-200 transition-colors font-mono"
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Largura */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs text-gray-400 font-medium">Largura (mm)</label>
                {largNum > 0 && largura && (largura.includes('/') || largura.includes('"') || largura.toLowerCase().includes('pol')) && (
                  <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/70 border border-emerald-700/50 px-1.5 py-0.2 rounded">
                    {largNum.toFixed(2).replace(/\.?0+$/, '')} mm
                  </span>
                )}
              </div>
              <input 
                ref={larguraRef}
                type="text" 
                tabIndex={4} 
                disabled={tipoMat !== 'chapa'}
                value={largura}
                onChange={(e) => setLargura(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    focusNextField(comprimentoRef);
                  }
                }}
                placeholder="0" 
                className="w-full bg-[#131f37] border border-gray-700 rounded-lg p-2.5 text-white focus:outline-hidden focus:border-blue-500 font-bold disabled:opacity-30 disabled:cursor-not-allowed"
              />
            </div>

            {/* Comprimento */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs text-gray-400 font-medium">Comprimento (mm)</label>
                {compNum > 0 && comprimento && (comprimento.includes('/') || comprimento.includes('"') || comprimento.toLowerCase().includes('pol')) && (
                  <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/70 border border-emerald-700/50 px-1.5 py-0.2 rounded">
                    {compNum.toFixed(2).replace(/\.?0+$/, '')} mm
                  </span>
                )}
              </div>
              <input 
                ref={comprimentoRef}
                type="text" 
                tabIndex={5} 
                value={comprimento}
                onChange={(e) => setComprimento(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    focusNextField(qtdRef);
                  }
                }}
                placeholder="0" 
                className="w-full bg-[#131f37] border border-gray-700 rounded-lg p-2.5 text-white focus:outline-hidden focus:border-blue-500 font-bold"
              />
            </div>

          </div>

          {/* DESCRIÇÃO (TABINDEX 6) */}
          <div>
            <label className="block text-xs text-gray-400 mb-1 font-medium">Descrição do Produto / Serviço</label>
            <input 
              type="text" 
              tabIndex={6} 
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Chapa Cortada Aço 1020..." 
              className="w-full bg-[#131f37] border border-gray-700 rounded-lg p-2.5 text-white focus:outline-hidden focus:border-blue-500"
            />
          </div>

          {/* OBSERVAÇÃO (TABINDEX 7) */}
          <div>
            <label className="block text-xs text-gray-400 mb-1 font-medium">Observação</label>
            <input 
              type="text" 
              tabIndex={7} 
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: CONF DESENHO, NYLON, TREFILADO SAE 1045..." 
              className="w-full bg-[#131f37] border border-gray-700 rounded-lg p-2.5 text-white focus:outline-hidden focus:border-blue-500"
            />
          </div>

          {/* LINHA 2: QUANTIDADE E PREÇO (TABINDEX 8 E 9) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">Qtd (Peças)</label>
              <input 
                ref={qtdRef}
                type="number" 
                tabIndex={8} 
                value={quantidade}
                min="1" 
                onChange={(e) => setQuantidade(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    focusNextField(precoKgRef);
                  }
                }}
                className="w-full bg-[#131f37] border border-gray-700 rounded-lg p-2.5 text-white focus:outline-hidden focus:border-blue-500 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">Preço / Kg (R$)</label>
              <input 
                ref={precoKgRef}
                type="number" 
                tabIndex={9} 
                step="1" 
                value={precoKg}
                onChange={(e) => setPrecoKg(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    adicionarAoPdv();
                  }
                }}
                placeholder="0" 
                className="w-full bg-[#131f37] border border-gray-700 rounded-lg p-2.5 text-white focus:outline-hidden focus:border-blue-500 font-bold"
              />
            </div>
          </div>

          {/* BANNER DE RESULTADOS DA COTAÇÃO */}
          <div className="bg-[#081226] border border-blue-600/40 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 shadow-inner">
            <div>
              <span className="block text-xs text-gray-400">Valor Unitário</span>
              <input 
                type="text" 
                readOnly 
                value={unitarioFormatted} 
                className="bg-transparent font-bold text-lg text-blue-300 w-full focus:outline-hidden"
              />
            </div>
            <div>
              <span className="block text-xs text-gray-400">Valor Total</span>
              <input 
                type="text" 
                readOnly 
                value={totalFormatted} 
                className="bg-transparent font-extrabold text-xl text-emerald-400 w-full focus:outline-hidden"
              />
            </div>
            <div>
              <span className="block text-xs text-gray-400">Peso Estimado</span>
              <input 
                type="text" 
                readOnly 
                value={pesoFormatted} 
                className="bg-transparent font-bold text-lg text-blue-400 w-full focus:outline-hidden"
              />
            </div>
          </div>

          {/* BOTÕES DE AÇÃO (TABINDEX 10 NO PRIMEIRO BOTÃO) */}
          <div className="space-y-2 pt-1">
            <button 
              ref={btnAdicionarRef}
              type="button" 
              tabIndex={10} 
              onClick={adicionarAoPdv} 
              onKeyDown={loopDeRotacao} 
              className="w-full bg-emerald-600 hover:bg-emerald-500 focus:ring-2 focus:ring-emerald-400 focus:outline-hidden text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
            >
              <span>🛍️</span> 
              <span>{addedMessage ? 'Adicionado ao Orçamento!' : 'Adicionar ao Orçamento PDV [ENTER]'}</span>
            </button>

            <button 
              type="button" 
              onClick={enviarParaNesting}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
            >
              <span>🧩</span> 
              <span>{nestingMessage ? 'Enviado para Otimização 2D!' : 'Enviar Chapa p/ Otimização Nesting 2D'}</span>
            </button>

            <button 
              type="button" 
              onClick={copiarResumo} 
              className="w-full bg-[#131f37] border border-gray-700 hover:bg-gray-800 text-gray-300 font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <span>📋</span> 
              <span>{copied ? 'Resumo Copiado!' : 'Copiar Resumo'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
