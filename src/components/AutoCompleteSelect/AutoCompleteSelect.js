import { useAutocomplete } from '@mui/base/AutocompleteUnstyled'
import { styled } from '@mui/material/styles'
import { useRef } from 'react'

const Label = styled('label')({
  display: 'block',
})

const Input = styled('input')(({ theme, ref }) => ({
  width: 200,
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.getContrastText(theme.palette.background.paper),
}))

const Listbox = styled('ul')(({ theme }) => ({
  width: '100%',
  margin: 0,
  padding: 0,
  zIndex: 1,
  position: 'absolute',
  listStyle: 'none',
  backgroundColor: theme.palette.background.paper,
  overflow: 'auto',
  maxHeight: 200,
  '& li[data-focus="true"]': {
    backgroundColor: '#4a8df6',
    color: 'white',
    cursor: 'pointer',
  },
  '& li:active': {
    backgroundColor: '#2977f5',
    color: 'white',
  },
}))

export default function UseAutocomplete({ painters }) {
  const {
    getRootProps,
    getInputLabelProps,
    getInputProps,
    getListboxProps,
    getOptionProps,
    groupedOptions,
  } = useAutocomplete({
    id: 'use-autocomplete-demo',
    options: painters,
    getOptionLabel: (painter) =>
      `${painter.First_Name + ' ' + painter.Last_Name}`,
  })

  const inputRef = useRef(null)
  return (
    <div>
      <div {...getRootProps()}>
        <Label {...getInputLabelProps()}>useAutocomplete</Label>
        <Input {...getInputProps()} />
      </div>
      {groupedOptions.length > 0 ? (
        <Listbox {...getListboxProps()}>
          {groupedOptions.map((option, index) => (
            <li {...getOptionProps({ option, index })}>
              {option.First_Name + ' ' + option.Last_Name}
            </li>
          ))}
        </Listbox>
      ) : null}
    </div>
  )
}
