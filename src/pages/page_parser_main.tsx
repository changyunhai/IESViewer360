
import { Input } from 'antd';
import { Button, Select, Space, Tooltip } from 'antd';
import { useAsyncEffect, useMount } from 'ahooks';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { utilIESGetContext, utilIESGetSphereMaxDistribution, utilIESIntegrate, utilIESOpenFile, utilIESSaveFile, utilIESSetContext } from '../util/util_ies';
import { IES, IES_LIBRARY, IES_SAMPLES } from '../model/model_parser';
import FileSaver from 'file-saver';
import { systemTime } from '../util/common';
import type { CollapseProps } from 'antd';
import { Collapse } from 'antd';
import PageParserView from './page_parser_views';
import version from '@/version.json';

export default () => {

    const [fileContent, setFileContent] = useState<string>('');
    const [fileName, setFileName] = useState<string>('');
    const [iesModel, setIESModel] = useState<IES | undefined>(undefined);

    const defaultIESFile = Object.keys(IES_SAMPLES)[0];//'LDP0109501.ies'//'4573.ies'//'MTD0700312.ies'//'LTD0110301.ies'//'test.ies'//
    useMount(() => {
        const ies = IES_LIBRARY[defaultIESFile].ies;
        utilIESSetContext(ies);
        setIESModel(ies);
    });

    useEffect(() => {
        const ies: IES | undefined = utilIESOpenFile(fileContent, fileName)
        if (!ies) return;
        utilIESSetContext(ies);
        setIESModel(ies);
    }, [fileContent]);

    async function openLocalIES(url: string) {
        url = 'asset/' + url;
        console.log('openurl', url);
        const iesContent = (await axios.get(url)).data;
        setFileName(url);
        setFileContent(iesContent);
    }

    const handleFileChange = (event: any) => {
        const file: File = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target!.result as string;
            setFileName(file.name)
            setFileContent(content as string);
            console.log("open", file.name, content.length);
        };
        reader.readAsText(file);
    };

    function printFullData(ies: IES): string[] {
        const fullData = utilIESGetContext().tensor;

        const lines: string[] = [];
        let line: any[] = ['*'];
        for (var i = 0; i < fullData[0].length; ++i)line.push(i);
        lines.push(line.join(','));


        for (var i = 0; i < fullData.length; ++i) {
            line = [i];
            for (var j = 0; j < fullData[i].length; ++j) line.push(fullData[i][j].toFixed(3));
            lines.push(line.join(','))
        }
        return lines;
    }


    // UI part:
    const items: CollapseProps['items'] = [
        {
            key: 'readme',
            label: 'How to use',
            children: <>
                <p>This is a demo page using Opple© 's IES file</p>
                <p>Select or upload a single ies file and view in 2d & 3d</p>
                <p>Current Build: {JSON.stringify(version)}</p>
            </>,

        },
        {
            key: 'io',
            label: 'select .IES file',
            children: <>
                <fieldset>
                    <legend className='text-left'>input</legend>
                    <Select
                        defaultValue={defaultIESFile}
                        style={{ width: 150 }}
                        onChange={(value: string) => { console.log('open document', value); openLocalIES(value) }}
                        options={Object.keys(IES_SAMPLES).map(key => {
                            return { value: key, label: IES_SAMPLES[key] }
                        })}
                    />
                    <span className='ml-5 mr-5'>Or</span>
                    <Input className='w-32' type="file" accept='.ies' onChange={handleFileChange} />
                </fieldset>
                <fieldset>
                    <legend className='text-left'>output</legend>
                    <Tooltip title='Save Current IES content to local'>
                        <Button className='w-20' type='primary' onClick={() => FileSaver.saveAs(new Blob([utilIESSaveFile().join('\n')]), `export-${systemTime()}.ies`)}>Save IES</Button>
                    </Tooltip>
                    <Tooltip title='Save full IES intensity distribution data in CSV file'>
                        <Button className='ml-5 w-20' type='primary' onClick={() => FileSaver.saveAs(new Blob([printFullData(iesModel!).join('\n')]), `full-ies-data-${systemTime()}.csv`)} >Save CSV</Button>
                    </Tooltip>
                </fieldset>
            </>,
        },
        {
            key: 'info',
            label: 'Photometric file info',
            children: <>
                <fieldset>
                    <legend className='text-left'>Basic</legend>
                    <div className='text-left'>
                        Lamp:<span className='text-red-400 ml-2 mr-6'>{utilIESIntegrate(undefined).toFixed(3)} lm</span>
                        Power:<span className='text-red-400 ml-2'>{iesModel?.header.power.toFixed(2)} W</span>
                    </div>
                    <div className='text-left'>
                        Latitude:<span className='text-red-400  mr-2'> [{iesModel?.header.latitude[0]},{iesModel?.header.latitude[iesModel?.header.latitude.length - 1]}]</span>
                        step=<span className='text-red-400 mr-2'>{iesModel?.header.latitude![1]! - iesModel?.header.latitude![0]!}</span>
                        count=<span className='text-red-400 '>{iesModel?.header.latitude.length}</span>
                    </div>
                    <div className='text-left'>
                        Longitude:<span className='text-red-400  mr-2'> [{iesModel?.header.longitude[0]},{iesModel?.header.longitude[iesModel?.header.longitude.length - 1]}]</span>
                        step=<span className='text-red-400 mr-2'>{iesModel?.header.longitude![1]! - iesModel?.header.longitude![0]!}</span>
                        count=<span className='text-red-400 '>{iesModel?.header.longitude.length}</span>
                    </div>
                    <div className='text-left'>
                        Max:
                        <span className='text-red-400 ml-4 mr-5'>{(() => {
                            const max = utilIESGetSphereMaxDistribution();
                            return `(${max.latitude}° ${max.longitude}°) ${max.intensity} cd`
                        })()}</span>
                    </div>

                </fieldset>
            </>,
        },
        {
            key: 'view',
            label: '2D & 3D View',
            children: <>
                <PageParserView ies={iesModel}></PageParserView>
            </>
        }
    ];

    return <>
        <Collapse items={items} defaultActiveKey={['', 'io', 'info', 'view']} />
    </>

}