import {
  defineForm,
  Email,
  Form,
  RadioGroup,
  Row,
  Submit,
  Text,
  Textarea,
  When,
} from '@open-form-build/core';

export const config = defineForm({
  title: 'Get in touch',
  description: 'We usually reply within a day.',
  submissions: {
    closedMessage: "We're not taking messages here right now.",
  },
  success: {
    title: 'Message sent',
    message: 'Thanks for writing. We usually reply within a day.',
  },
});

export default function Contact() {
  return (
    <Form>
      <Row>
        <Text name="name" label="Name" required autoComplete="name" />
        <Email name="email" label="Email" required />
      </Row>
      <RadioGroup
        name="topic"
        label="What is this about?"
        required
        variant="cards"
        options={['Question', 'Feedback', 'Partnership', 'Other']}
      />
      <When field="topic" equals="Other">
        <Text name="otherTopic" label="Tell us the topic" required />
      </When>
      <Textarea name="message" label="Message" required rows={5} maxLength={2000} />
      <Submit>Send message</Submit>
    </Form>
  );
}
