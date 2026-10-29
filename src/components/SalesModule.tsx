// Add or Update item
  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (saveInFlightRef.current) return;

    if (!itemDescription.trim()) {
      setErrorMessage('Por favor, informe a descrição do item.');
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }

    const rawUnitPriceNum = isSpecialItem
      ? (currentFormPriceKg > 0 ? currentFormPriceKg : (parseNumberBR(itemUnitPrice) || 0))
      : (parseNumberBR(itemUnitPrice) || calculatedUnitPrice);
    const unitPriceNum = isSpecialItem ? rawUnitPriceNum : Math.ceil(rawUnitPriceNum);
    if (unitPriceNum <= 0) {
      setErrorMessage('O valor unitário deve ser maior que zero (R$). Verifique as medidas ou o Preço/Kg.');
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }

    const qtyNum = parseFloat(itemQuantity) || 1;
    if (qtyNum <= 0) {
      setErrorMessage('A quantidade deve ser de no mínimo 1 unidade.');
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }

    const subtotal = isSpecialItem
      ? Number((qtyNum * unitPriceNum).toFixed(2))
      : calculateItemSubtotal(unitPriceNum, qtyNum);

    const { unitWeightKg: geoUnitWeightKg, totalWeightKg: geoTotalWeightKg } = calculateItemWeightKg({
      geometryType: itemGeometryType,
      constant: currentFormConstant,
      diameterMm: effectiveDiameterMm,
      thicknessMm: effectiveThicknessMm,
      widthMm: effectiveWidthMm,
      lengthMm: effectiveLengthMm,
      quantity: qtyNum,
      diameterStr: itemDiameter,
      thicknessStr: itemThickness
    });

    const unitWeightKg = isSpecialItem ? 0 : geoUnitWeightKg;
    const totalWeightKg = isSpecialItem ? 0 : geoTotalWeightKg;

    const priceKgNum = isSpecialItem
      ? unitPriceNum
      : (parseNumberBR(itemPricePerKg) || (unitWeightKg > 0 ? unitPriceNum / unitWeightKg : undefined));

    const widthMmFormatted = effectiveWidthMm > 0 ? `${effectiveWidthMm}mm` : (itemWidthMm.trim() ? formatDimensaoMm(itemWidthMm) : '');
    const lengthMmFormatted = effectiveLengthMm > 0 ? `${effectiveLengthMm}mm` : (itemLengthMm.trim() ? formatDimensaoMm(itemLengthMm) : '');

    const formattedWidthLength = isSpecialItem
      ? '—'
      : (itemGeometryType === 'CHAPA_RETANGULO' || itemGeometryType === 'chapa'
          ? (widthMmFormatted && lengthMmFormatted ? `${widthMmFormatted} x ${lengthMmFormatted}` : itemWidthLength.trim() || '-')
          : (lengthMmFormatted ? `${lengthMmFormatted}` : itemWidthLength.trim() || '-'));

    const itemMatName = itemConstantName.trim() || (isSpecialItem ? itemDescription.trim() : 'CHAPA');
    const tempItemData = {
      geometryType: itemGeometryType,
      diameter: isSpecialItem ? '' : itemDiameter.trim(),
      thickness: isSpecialItem ? '' : itemThickness.trim(),
      measure: isSpecialItem ? '—' : (itemThickness.trim() || itemDiameter.trim()),
      widthMm: effectiveWidthMm > 0 ? effectiveWidthMm : undefined,
      lengthMm: effectiveLengthMm > 0 ? effectiveLengthMm : undefined,
      widthLength: formattedWidthLength,
      diameterMm: effectiveDiameterMm > 0 ? effectiveDiameterMm : undefined,
      thicknessMm: effectiveThicknessMm > 0 ? effectiveThicknessMm : undefined
    };
    const medidasFormatadas = isSpecialItem
      ? '—'
      : formatarMedidasLimpa(tempItemData);

    const thickFormatted = isSpecialItem ? '' : (effectiveThicknessMm > 0 ? formatDimensaoPolegada(effectiveThicknessMm) : (itemThickness.trim() ? formatDimensaoPolegada(itemThickness) : ''));
    const diaFormatted = isSpecialItem ? '' : (effectiveDiameterMm > 0 ? formatDimensaoPolegada(effectiveDiameterMm) : (itemDiameter.trim() ? formatDimensaoPolegada(itemDiameter) : ''));
    const widthFormatted = isSpecialItem ? '' : widthMmFormatted;
    const lengthFormatted = isSpecialItem ? '' : lengthMmFormatted;

    const defaultFormatDesc = isSpecialItem
      ? (itemDescription.trim() || 'Serviço')
      : (itemGeometryType === 'macico' || itemGeometryType === 'REDONDO_QUADRADO'
          ? 'Trefilado'
          : (itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA' ? 'Bucha / Tubo Mecânico' : 'Retângulo'));

    const resolvedDesc = (itemDescription.trim() && itemDescription.trim().toLowerCase() !== itemMatName.trim().toLowerCase())
      ? itemDescription.trim()
      : defaultFormatDesc;

    let updatedItemsList: QuoteItem[];

    // CORREÇÃO DA CONDICIONAL DE ATUALIZAÇÃO: Garante o mapeamento seguro pelo ID ativo no state
    if (editingItemId) {
      updatedItemsList = items.map(item => {
        if (item.id === editingItemId) {
          return {
            ...item,
            companyName: clientName || 'UsiCorte Cliente',
            description: resolvedDesc,
            descricao: resolvedDesc,
            constantName: itemMatName,
            constanteNome: itemMatName,
            material: itemMatName,
            produto: itemMatName,
            geometryType: itemGeometryType,
            constant: isSpecialItem ? '0' : (itemConstant.trim() || '0.00785'),
            pricePerKg: priceKgNum,
            measure: isSpecialItem ? '—' : (medidasFormatadas || itemThickness.trim() || itemDiameter.trim()),
            thickness: thickFormatted,
            espessura: thickFormatted,
            thicknessMm: effectiveThicknessMm > 0 ? effectiveThicknessMm : undefined,
            espessuraMm: effectiveThicknessMm > 0 ? effectiveThicknessMm : undefined,
            diameter: diaFormatted,
            diametro: diaFormatted,
            diameterMm: effectiveDiameterMm > 0 ? effectiveDiameterMm : undefined,
            diametroMm: effectiveDiameterMm > 0 ? effectiveDiameterMm : undefined,
            widthLength: formattedWidthLength,
            widthMm: effectiveWidthMm > 0 ? effectiveWidthMm : undefined,
            largura: widthFormatted,
            larguraMm: effectiveWidthMm > 0 ? effectiveWidthMm : undefined,
            lengthMm: effectiveLengthMm > 0 ? effectiveLengthMm : undefined,
            comprimento: lengthFormatted,
            comprimentoMm: effectiveLengthMm > 0 ? effectiveLengthMm : undefined,
            unitWeightKg: unitWeightKg,
            totalWeightKg: totalWeightKg,
            pesoTotal: totalWeightKg,
            unitPrice: unitPriceNum,
            valorUnitario: unitPriceNum,
            quantity: qtyNum,
            qtd: qtyNum,
            subtotal: subtotal,
            notes: itemNotes.trim(),
            observacao: itemNotes.trim(),
            info: itemNotes.trim(),
            medidasFormatadas: medidasFormatadas,
            medidaFormatada: medidasFormatadas,
            drawingImage: itemDrawingImage || undefined,
            fotoDesenho: itemDrawingImage || undefined,
            ncm: item.ncm || findProductOrMaterialData(itemMatName)?.ncm || '72085200',
            cfop_interno: item.cfop_interno || findProductOrMaterialData(itemMatName)?.cfop_interno || '5102',
            cfop_externo: item.cfop_externo || findProductOrMaterialData(itemMatName)?.cfop_externo || '6102',
            unidade_medida: item.unidade_medida || findProductOrMaterialData(itemMatName)?.unidade_medida || 'PC',
            unidadeMedida: item.unidadeMedida || findProductOrMaterialData(itemMatName)?.unidade_medida || 'PC',
            csosn: (!item.csosn || item.csosn.includes('102') || item.csosn.includes('101')) 
              ? '101 - Com permissão de crédito' 
              : (findProductOrMaterialData(itemMatName)?.csosn || '101 - Com permissão de crédito')
          };
        }
        return item;
      });

      setItems(updatedItemsList);
      setSuccessMessage('Item atualizado com sucesso!');
      setEditingItemId(null);
    } else {
      const fiscalData = findProductOrMaterialData(itemMatName) || findProductOrMaterialData(itemConstantSelect) || findProductOrMaterialData(selectedMaterial?.id) || findProductOrMaterialData(itemDescription);
      const newItem: QuoteItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        date: quoteDate || new Date().toISOString().split('T')[0],
        companyName: clientName || 'UsiCorte Cliente',
        description: resolvedDesc,
        descricao: resolvedDesc,
        constantName: itemMatName,
        constanteNome: itemMatName,
        material: itemMatName,
        geometryType: itemGeometryType,
        constant: isSpecialItem ? '0' : (itemConstant.trim() || '0.00785'),
        pricePerKg: priceKgNum,
        measure: isSpecialItem ? '—' : (medidasFormatadas || itemThickness.trim() || itemDiameter.trim()),
        thickness: thickFormatted,
        espessura: thickFormatted,
        thicknessMm: effectiveThicknessMm > 0 ? effectiveThicknessMm : undefined,
        espessuraMm: effectiveThicknessMm > 0 ? effectiveThicknessMm : undefined,
        diameter: diaFormatted,
        diametro: diaFormatted,
        diameterMm: effectiveDiameterMm > 0 ? effectiveDiameterMm : undefined,
        diametroMm: effectiveDiameterMm > 0 ? effectiveDiameterMm : undefined,
        widthLength: formattedWidthLength,
        widthMm: effectiveWidthMm > 0 ? effectiveWidthMm : undefined,
        largura: widthFormatted,
        larguraMm: effectiveWidthMm > 0 ? effectiveWidthMm : undefined,
        lengthMm: effectiveLengthMm > 0 ? effectiveLengthMm : undefined,
        comprimento: lengthFormatted,
        comprimentoMm: effectiveLengthMm > 0 ? effectiveLengthMm : undefined,
        unitWeightKg: unitWeightKg,
        totalWeightKg: totalWeightKg,
        pesoTotal: totalWeightKg,
        unitPrice: unitPriceNum,
        valorUnitario: unitPriceNum,
        quantity: qtyNum,
        qtd: qtyNum,
        subtotal: subtotal,
        notes: itemNotes.trim(),
        observacao: itemNotes.trim(),
        info: itemNotes.trim(),
        medidasFormatadas: medidasFormatadas,
        medidaFormatada: medidasFormatadas,
        drawingImage: itemDrawingImage || undefined,
        fotoDesenho: itemDrawingImage || undefined,
        ncm: fiscalData?.ncm || '72085200',
        cfop_interno: fiscalData?.cfop_interno || '5102',
        cfop_externo: fiscalData?.cfop_externo || '6102',
        unidade_medida: fiscalData?.unidade_medida || 'PC',
        unidadeMedida: fiscalData?.unidade_medida || 'PC',
        csosn: (!fiscalData?.csosn || fiscalData.csosn.includes('102') || fiscalData.csosn.includes('101')) 
          ? '101 - Com permissão de crédito' 
          : fiscalData.csosn
      };

      updatedItemsList = [...items, newItem];
      setItems(updatedItemsList);
      setSuccessMessage('Item adicionado à cotação com sucesso!');
    }

    resetItemForm();
    setTimeout(() => setSuccessMessage(null), 3000);
  };
