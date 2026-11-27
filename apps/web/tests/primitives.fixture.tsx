import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, IconButton } from "../src/components/ui/buttons";
import { Checkbox, Input, Radio, Select, Switch, Textarea } from "../src/components/ui/fields";
import { Alert, Badge, Skeleton } from "../src/components/ui/feedback";
import { Tooltip } from "../src/components/ui/tooltip";

function Fixture() {
  const [submits, setSubmits] = useState(0);
  return (
    <main style={{ padding: "1rem", maxWidth: "28rem" }}>
      <h1>آزمون کامپوننت‌ها</h1>
      <form onSubmit={(event) => { event.preventDefault(); setSubmits((count) => count + 1); }}>
        <Input label="نام مجموعه" hint="نام را وارد کنید." />
        <Textarea label="توضیح" error="توضیح لازم است." />
        <Select label="شعبه">
          <option value="central">مرکزی</option>
          <option value="north">شمال</option>
        </Select>
        <Select label="دریافت شعبه‌ها" loading><option>در انتظار</option></Select>
        <Checkbox label="پذیرش" />
        <Radio label="صبح" name="turn" defaultChecked />
        <Radio label="عصر" name="turn" />
        <Switch label="فعال" />
        <Switch label="غیرفعال" disabled />
        <Button type="submit" loading>در حال ارسال</Button>
        <Button type="submit" disabled>ارسال غیرفعال</Button>
        <Button type="submit">ارسال</Button>
        <output aria-label="تعداد ارسال">{submits}</output>
      </form>
      <Tooltip content="اطلاعات بیشتر دربارهٔ ظرفیت">
        {(descriptionId) => <IconButton label="راهنمای ظرفیت" aria-describedby={descriptionId}>؟</IconButton>}
      </Tooltip>
      <Badge tone="success">تأیید شده</Badge>
      <Alert tone="error" live>خطای نمونه</Alert>
      <Skeleton />
    </main>
  );
}

const root = document.getElementById("fixture");
if (!root) throw new Error("Fixture mount is missing.");
createRoot(root).render(<Fixture />);
