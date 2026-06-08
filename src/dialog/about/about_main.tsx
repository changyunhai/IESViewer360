
import { IDialog, DefaultFooter } from "../open_dialog"
import { Button, InputNumber, Layout, Radio, RadioChangeEvent } from "antd"
import { Header, Content, Footer } from "antd/es/layout/layout"
import version from '@/version.json';


export default ({ onSubmit, onCancel }: IDialog<any>) => {
    return <>
        <Layout>
            <Content >
                <div className="w-full">Current Build: <span>{JSON.stringify(version)}</span></div>
                <div className='h-10'></div>
            </Content>
            <DefaultFooter onSubmit={() => {
                if (onSubmit) onSubmit({});
            }} onCancel={onCancel} />
        </Layout>
    </>
}

