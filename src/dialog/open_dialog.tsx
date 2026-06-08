import { Button, Modal } from 'antd';
import React from 'react';
import { createRoot } from "react-dom/client";


export interface IDialog<T> {
    onSubmit?: (values: T) => void;
    onCancel?: () => void;
}

export interface IDialogFooter<T> extends IDialog<T> {
    okText?: string;
    cancelText?: string;
}

interface IDialogBase<T> {
    width: number;
    title?: string;
    closable?: boolean;
    content: React.ReactElement & IDialog<T>;
}

function openDialog<T = any>(param: IDialogBase<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        const div = document.createElement('div');
        document.body.appendChild(div);
        const root = createRoot(div);

        const destroy = () => {
            root.unmount()
            div.remove()
        };

        const onCancel = () => {
            destroy();
            resolve(undefined!);
        };

        const onSubmit = (values: T) => {
            destroy();
            resolve(values);
        };

        root.render(<Modal
            title={param.title}
            width={param.width}
            open={true}
            footer={null}
            closable={param.closable}
            onCancel={onCancel}
        >
            {React.cloneElement(param.content, { onCancel, onSubmit })}
        </Modal>)
    })
}

export const DefaultFooter = ({ okText, cancelText, onSubmit, onCancel }: IDialogFooter<any>) => {
    return <div className='flex justify-end mr-4 gap-2'>
        <Button type="primary" size="large" onClick={onSubmit} className="w-20 border-r-2">
            {okText || "OK"}
        </Button>
        <Button size="large" onClick={onCancel} className="w-20 border-r-2" >
            {cancelText || "Cancel"}
        </Button>
    </div>
}
export default openDialog;