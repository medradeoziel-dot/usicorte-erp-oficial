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
  isRetalhoOrMaoDeObra,
  TabelaConstanteItem 
} from '../utils/calculator';
import { useMaterialsCatalog } from '../services/materialsService';
import MaterialAutocomplete, { AutocompleteOption } from './MaterialAutocomplete';

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
  // Catálogo dinâmico de materiais conectado ao Supabase
  const { constantes: dynamicConstantes, materials } = useMaterialsCatalog();
  const activeConstantes = dynamicConstantes.length > 0 ? dynamicConstantes : tabelaConstantes;

  // Form State
  const defaultLaserIdx = activeConstantes.findIndex(m => m.nome === 'LASER A36');
  const [materialIndex, setMaterialIndex] = useState<string>(() => defaultLaserIdx !== -1 ? String(defaultLaserIdx) : '19'); // Default: LASER A36
  const [materialQuery, setMaterialQuery] = useState<string>('LASER A36');
  const [isMaterialOpen, setIsMaterialOpen] = useState<boolean>(false);
  const [materialHighlightIdx, setMaterialHighlightIdx] = useState<number>(0);

  const [tipo, setTipo] = useState<'chapa' | 'macico' | 'bucha'>('chapa');
  const [kCustom, setKCustom] = useState<number>(0.00785);
  const [precoKg, setPrecoKg] = useState<string>('22');
  
  const [diametro, setDiametro] = useState<string>('0');
  const [espessura, setEspessura] = useState<string>('');
  const [largura, setLargura] = useState<string>('');
  const [comprimento, setComprimento] = useState<string>('');
  const [quantidade, setQuantidade] = useState<string>('1');
  const [pesoManualKg, setPesoManualKg] = useState<string>('1');
  const [descricao, setDescricao] = useState<string>('LASER A36');
  const [isDescricaoOpen, setIsDescricaoOpen] = useState<boolean>(false);
  const [descricaoHighlightIdx, setDescricaoHighlightIdx] = useState<number>(0);
  const [observacao, setObservacao] = useState<string>('');

  const [showBitolasModal, setShowBitolasModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [addedMessage, setAddedMessage] = useState<boolean>(false);
  const [nestingMessage, setNestingMessage] = useState<boolean>(false);

  // Refs for tab loop navigation and click outside
  const materialBoxRef = useRef<HTMLDivElement>(null);
  const descricaoBoxRef = useRef<HTMLDivElement>(null);
  const constanteRef = useRef<HTMLInputElement>(null);
  const diametroRef = useRef<HTMLInputElement>(null);
  const espessuraRef = useRef<HTMLInputElement>(null);
  const larguraRef = useRef<HTMLInputElement>(null);
  const comprimentoRef = useRef<HTMLInputElement>(null);
  const descricaoRef = useRef<HTMLInputElement>(null);
  const qtdRef = useRef<HTMLInputElement>(null);
  const pesoManualRef = useRef<HTMLInputElement>(null);
  const precoKgRef = useRef<HTMLInputElement>(null);
  const btnAdicionarRef = useRef<HTMLButtonElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (materialBoxRef.current && !materialBoxRef.current.contains(event.target as Node)) {
        setIsMaterialOpen(false);
      }
      if (descricaoBoxRef.current && !descricaoBoxRef.current.contains(event.target as Node)) {
        setIsDescricaoOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizeSearch = (str: string) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const matchesSearch = (queryRaw: string, item: TabelaConstanteItem) => {
    const q = normalizeSearch(queryRaw);
    if (!q) return true;
    const target = normalizeSearch(`${item.nome} ${item.tipo} ${item.k} ${item.precoKg}`);
    if (target.includes(q)) return true;
    const tokens = q.split(/\s+/).filter(Boolean);
    return tokens.length > 1 && tokens.every(t => target.includes(t));
  };

  const filteredMaterialsForConstante = activeConstantes
    .map((mat, idx) => ({ mat, idx }))
    .filter(({ mat }) => matchesSearch(materialQuery, mat));

  const filteredMaterialsForDescricao = activeConstantes
    .map((mat, idx) => ({ mat, idx }))
    .filter(({ mat }) => matchesSearch(descricao, mat));

  // Sync material selection
  const handleMaterialSelect = (indexStr: string, fromField: 'constante' | 'descricao' = 'constante') => {
    setMaterialIndex(indexStr);
    if (indexStr === "") {
      return;
    }

    const idx = parseInt(indexStr, 10);
    const mat = activeConstantes[idx];
    if (mat) {
      // a) Localiza o objeto do material selecionado na lista carregada do Supabase
      const material = materials.find(
        m => m.nome.trim().toLowerCase() === mat.nome.trim().toLowerCase()
      );
      // b) Preenche automaticamente "Descrição do Produto / Serviço" APENAS com material.descricao
      // c) Se material.descricao estiver vazio ou nulo, utiliza apenas material.nome
      const descFinal = (material && material.descricao && material.descricao.trim() !== '')
        ? material.descricao.trim()
        : (material ? material.nome : mat.nome);

      setTipo(mat.tipo);
      setKCustom(mat.k);
      setPrecoKg(String(Math.ceil(mat.precoKg)));
      setMaterialQuery(mat.nome);
      setDescricao(descFinal);
      setIsMaterialOpen(false);
      setIsDescricaoOpen(false);

      if (isRetalhoOrMaoDeObra(mat.nome, descFinal)) {
        setDiametro('');
        setEspessura('');
        setLargura('');
        setComprimento('');
        setPesoManualKg('0');
        focusNextField(qtdRef);
        return;
      }

      if (mat.tipo === 'chapa') {
        setDiametro('0');
      } else if (mat.tipo === 'macico') {
        setEspessura('');
        setLargura('');
      } else if (mat.tipo === 'bucha') {
        setLargura('');
      }

      if (fromField === 'constante') {
        if (mat.tipo === 'chapa') focusNextField(espessuraRef);
        else focusNextField(diametroRef);
      } else {
        const hasDims = mat.tipo === 'chapa' ? Boolean(espessura.trim()) : Boolean(diametro.trim() && diametro !== '0');
        if (!hasDims) {
          if (mat.tipo === 'chapa') focusNextField(espessuraRef);
          else focusNextField(diametroRef);
        } else {
          focusNextField(qtdRef);
        }
      }
    }
  };

  // Preset Sheet dimensions helper
  const aplicarDimensao = (larg: number, comp: number) => {
    setLargura(String(larg));
    setComprimento(String(comp));
  };

  // Calculations strictly per UsiCorte official formulas & Math.ceil rounding
  const isSpecialCalcItem = isRetalhoOrMaoDeObra(materialQuery, descricao);
  const selectedMat: TabelaConstanteItem | undefined = materialIndex !== "" ? activeConstantes[parseInt(materialIndex, 10)] : undefined;
  const kConst = isSpecialCalcItem ? 0 : (selectedMat ? selectedMat.k : kCustom);
  const tipoMat = selectedMat ? selectedMat.tipo : tipo;

  const diaNum = isSpecialCalcItem ? 0 : parseDimensionToMm(diametro);
  const espNum = isSpecialCalcItem ? 0 : parseDimensionToMm(espessura);
  const largNum = isSpecialCalcItem ? 0 : parseDimensionToMm(largura);
  const compNum = isSpecialCalcItem ? 0 : parseDimensionToMm(comprimento);
  const priceKgNum = parseNumberBR(precoKg);
  const qtdNum = Math.max(1, parseNumberBR(quantidade) || 1);

  // Calculate Unit Weight
  let pesoUnitario = 0;

  if (isSpecialCalcItem) {
    pesoUnitario = 0;
  } else if (kConst >= 0) {
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
  // For RETALHO / MÃO DE OBRA / SERVIÇOS (cálculo direto):
  // • Peso Unitário = 0.000 Kg e Peso Total = 0.000 Kg
  // • Valor Unitário (R$) = Preço Unitário digitado
  // • Subtotal (R$) = Quantidade × Valor Unitário (R$)
  const valorUnitarioCalculado = isSpecialCalcItem ? priceKgNum : (pesoUnitario * priceKgNum);
  const valorUnitarioArredondado = isSpecialCalcItem ? valorUnitarioCalculado : Math.ceil(valorUnitarioCalculado);

  const valorTotalCalculado = qtdNum * valorUnitarioArredondado;
  const valorTotalArredondado = isSpecialCalcItem ? Number(valorTotalCalculado.toFixed(2)) : Math.ceil(valorTotalCalculado);

  const pesoTotal = isSpecialCalcItem ? 0 : (qtdNum * pesoUnitario);

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
    setDiametro(isSpecialCalcItem ? '' : (tipoMat === 'chapa' ? '0' : ''));
    setEspessura('');
    setLargura('');
    setComprimento('');
    setQuantidade('1');
    setPesoManualKg('1');
    setObservacao('');
    focusNextField(constanteRef);
  };

  const adicionarAoPdv = () => {
    if (materialIndex === "" && !materialQuery.trim() && !descricao.trim()) {
      focusNextField(constanteRef);
      return;
    }

    const descFinal = descricao.trim() || materialQuery.trim() || (selectedMat ? selectedMat.nome : 'Material');

    const newItem = {
      id: `item-${Date.now()}`,
      description: descFinal,
      descricao: descFinal,
      material: selectedMat ? selectedMat.nome : (materialQuery.trim() || descFinal),
      constantName: selectedMat ? selectedMat.nome : (materialQuery.trim() || descFinal),
      constanteNome: selectedMat ? selectedMat.nome : (materialQuery.trim() || descFinal),
      geometryType: tipoMat,
      constant: isSpecialCalcItem ? '0' : String(kConst),
      pricePerKg: priceKgNum,
      diameter: isSpecialCalcItem ? '' : diametro,
      thickness: isSpecialCalcItem ? '' : espessura,
      measure: isSpecialCalcItem ? '—' : (espessura || diametro),
      medidasFormatadas: isSpecialCalcItem ? '—' : undefined,
      medidaFormatada: isSpecialCalcItem ? '—' : undefined,
      widthMm: isSpecialCalcItem ? undefined : largNum,
      lengthMm: isSpecialCalcItem ? undefined : compNum,
      quantity: qtdNum,
      qtd: qtdNum,
      unitWeightKg: isSpecialCalcItem ? 0 : Number(pesoUnitario.toFixed(3)),
      totalWeightKg: isSpecialCalcItem ? 0 : Number(pesoTotal.toFixed(3)),
      pesoTotal: isSpecialCalcItem ? 0 : Number(pesoTotal.toFixed(3)),
      unitPrice: valorUnitarioArredondado,
      valorUnitario: valorUnitarioArredondado,
      subtotal: valorTotalArredondado,
      notes: observacao,
      observacao: observacao
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
          
          {/* SELEÇÃO DE MATERIAL (TABINDEX 1) COM AUTOCOMPLETE AUTOMÁTICO */}
          <div className="relative" ref={materialBoxRef}>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-gray-400 font-medium">Constante / Material</label>
              <span className="text-[10px] font-mono text-blue-400 bg-blue-950/60 border border-blue-800/50 px-1.5 py-0.2 rounded">
                k={kConst} • R$ {precoKg || '0'}/Kg
              </span>
            </div>
            <input
              ref={constanteRef}
              type="text"
              tabIndex={1}
              value={materialQuery}
              autoComplete="off"
              placeholder="Digite o material (ex: oxi, 1045, aço, laser...)"
              onChange={(e) => {
                const val = e.target.value;
                setMaterialQuery(val);
                setMaterialHighlightIdx(0);
                setIsMaterialOpen(true);
                const material = materials.find(
                  m => m.nome.trim().toLowerCase() === val.trim().toLowerCase()
                );
                let nextDesc = descricao;
                if (material) {
                  nextDesc =
                    material.descricao && material.descricao.trim() !== ''
                      ? material.descricao.trim()
                      : material.nome;
                  setDescricao(nextDesc);
                  setTipo(material.tipo);
                  setKCustom(material.k);
                  setPrecoKg(String(Math.ceil(material.precoKg)));
                }
                const normVal = val.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (isRetalhoOrMaoDeObra(val, nextDesc)) {
                  setDiametro('');
                  setEspessura('');
                  setLargura('');
                  setComprimento('');
                  if (normVal === 'retalho' || normVal === 'mao de obra') {
                    setIsMaterialOpen(false);
                    if (!material && normVal === 'retalho') {
                      setDescricao('RETALHO');
                      setKCustom(0);
                      setPrecoKg('15');
                    } else if (!material && normVal === 'mao de obra') {
                      setDescricao('MÃO DE OBRA');
                      setKCustom(0);
                    }
                    focusNextField(qtdRef);
                  }
                }
              }}
              onInput={(e) => {
                const val = (e.target as HTMLInputElement).value;
                setMaterialQuery(val);
                setMaterialHighlightIdx(0);
                setIsMaterialOpen(true);
              }}
              onFocus={(e) => {
                setIsMaterialOpen(true);
                setMaterialHighlightIdx(0);
                e.target.select();
              }}
              onClick={() => setIsMaterialOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setIsMaterialOpen(true);
                  if (filteredMaterialsForConstante.length > 0) {
                    setMaterialHighlightIdx(prev => (prev + 1) % filteredMaterialsForConstante.length);
                  }
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setIsMaterialOpen(true);
                  if (filteredMaterialsForConstante.length > 0) {
                    setMaterialHighlightIdx(prev => (prev - 1 + filteredMaterialsForConstante.length) % filteredMaterialsForConstante.length);
                  }
                } else if (e.key === 'Enter' || e.key === 'Tab') {
                  if (isMaterialOpen && filteredMaterialsForConstante.length > 0) {
                    e.preventDefault();
                    const picked = filteredMaterialsForConstante[materialHighlightIdx] || filteredMaterialsForConstante[0];
                    handleMaterialSelect(String(picked.idx), 'constante');
                    return;
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setIsMaterialOpen(false);
                    if (isSpecialCalcItem) focusNextField(qtdRef);
                    else if (tipoMat === 'chapa') focusNextField(espessuraRef);
                    else focusNextField(diametroRef);
                  } else if (e.key === 'Tab') {
                    setIsMaterialOpen(false);
                    if (isSpecialCalcItem) {
                      e.preventDefault();
                      focusNextField(qtdRef);
                    }
                  }
                } else if (e.key === 'Escape') {
                  setIsMaterialOpen(false);
                }
              }}
              className="w-full bg-[#131f37] border border-gray-700 rounded-lg p-2.5 text-white focus:outline-hidden focus:border-blue-500 font-bold"
            />

            {isMaterialOpen && (
              <div className="absolute top-full left-0 w-full z-50 bg-slate-900 border border-slate-700 rounded-md shadow-2xl max-h-60 overflow-y-auto mt-1 p-1.5 space-y-1">
                {filteredMaterialsForConstante.length > 0 ? (
                  filteredMaterialsForConstante.map(({ mat, idx }, listIdx) => {
                    const isHighlighted = listIdx === materialHighlightIdx;
                    return (
                      <button
                        key={`${mat.nome}-${idx}`}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleMaterialSelect(String(idx), 'constante');
                        }}
                        onMouseEnter={() => setMaterialHighlightIdx(listIdx)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition cursor-pointer ${
                          isHighlighted
                            ? 'bg-blue-600 text-white font-bold'
                            : 'text-gray-200 hover:bg-[#1a2946]'
                        }`}
                      >
                        <span>{mat.nome}</span>
                        <span className={`font-mono text-[11px] ${isHighlighted ? 'text-blue-100' : 'text-blue-400'}`}>
                          k: {mat.k} | R$ {Math.ceil(mat.precoKg)}/kg
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-2 text-xs text-gray-400">
                    Personalizado: <strong className="text-white">"{materialQuery}"</strong> (mantendo k={kConst} | R$ {precoKg}/kg)
                  </div>
                )}
              </div>
            )}
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
                disabled={isSpecialCalcItem || tipoMat === 'chapa'}
                value={diametro}
                onChange={(e) => setDiametro(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (isSpecialCalcItem) focusNextField(qtdRef);
                    else if (tipoMat === 'bucha') focusNextField(espessuraRef);
                    else focusNextField(comprimentoRef);
                  }
                }}
                placeholder={isSpecialCalcItem ? '—' : 'Ex: 32 ou 1.1/2'} 
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
                disabled={isSpecialCalcItem || tipoMat === 'macico'}
                value={espessura}
                onChange={(e) => setEspessura(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (isSpecialCalcItem) focusNextField(qtdRef);
                    else if (tipoMat === 'chapa') focusNextField(larguraRef);
                    else focusNextField(comprimentoRef);
                  }
                }}
                placeholder={isSpecialCalcItem ? '—' : 'Ex: 12.7 ou 1/2'} 
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
                disabled={isSpecialCalcItem || tipoMat !== 'chapa'}
                value={largura}
                onChange={(e) => setLargura(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    focusNextField(isSpecialCalcItem ? qtdRef : comprimentoRef);
                  }
                }}
                placeholder={isSpecialCalcItem ? '—' : '0'} 
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
                disabled={isSpecialCalcItem}
                value={comprimento}
                onChange={(e) => setComprimento(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    focusNextField(qtdRef);
                  }
                }}
                placeholder={isSpecialCalcItem ? '—' : '0'} 
                className="w-full bg-[#131f37] border border-gray-700 rounded-lg p-2.5 text-white focus:outline-hidden focus:border-blue-500 font-bold disabled:opacity-30 disabled:cursor-not-allowed"
              />
            </div>

          </div>

          {/* DESCRIÇÃO (TABINDEX 6) - PREENCHIDA A PARTIR DO CADASTRO DE PRODUTOS E EDITÁVEL MANUALMENTE */}
          <div className="relative" ref={descricaoBoxRef}>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-gray-400 font-medium">Descrição do Produto / Serviço</label>
              <span className="text-[10px] font-mono text-emerald-400">
                k={kConst} • R$ {precoKg || '0'}/Kg
              </span>
            </div>
            <input 
              ref={descricaoRef}
              type="text" 
              tabIndex={6} 
              value={descricao}
              autoComplete="off"
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const val = e.target.value;
                setDescricao(val);
                const normVal = val.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (isRetalhoOrMaoDeObra(materialQuery, val)) {
                  setDiametro('');
                  setEspessura('');
                  setLargura('');
                  setComprimento('');
                  if (normVal === 'retalho' || normVal === 'mao de obra') {
                    if (normVal === 'retalho') {
                      setMaterialQuery('RETALHO');
                      setKCustom(0);
                      setPrecoKg('15');
                    } else if (normVal === 'mao de obra') {
                      setMaterialQuery('MÃO DE OBRA');
                      setKCustom(0);
                    }
                    focusNextField(qtdRef);
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  focusNextField(qtdRef);
                }
              }}
              placeholder="Preenchido pelo material ou digite manualmente..." 
              className="w-full bg-[#131f37] border border-gray-700 rounded-lg p-2.5 text-white focus:outline-hidden focus:border-blue-500 font-bold"
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
